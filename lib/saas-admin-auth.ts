import "server-only";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, quoteIdentifier, tableExists, columnExists } from "@/lib/tenant-db";
import { tenantSessionSuffix } from "@/lib/tenant-runtime";

export type SaasAdminRole = "owner" | "admin" | "viewer";

export type SaasAdminUser = {
  id: number;
  name: string;
  email: string;
  role: SaasAdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
};

export type SaasAdminSession = {
  user: SaasAdminUser;
  issuedAt: number;
};

type SaasAdminRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash?: string;
  role?: string;
  is_active?: number;
  last_login_at?: string | Date | null;
};

type LoginResult =
  | { ok: true; session: SaasAdminSession }
  | { ok: false; error: string };

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 10;

export async function ensureSaasAuthSchema(): Promise<void> {
  if (!(await tableExists("saas_admins"))) {
    await dbExecute(
      `CREATE TABLE IF NOT EXISTS \`saas_admins\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(120) NOT NULL,
      \`email\` VARCHAR(190) NOT NULL,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`role\` ENUM('owner','admin','viewer') NOT NULL DEFAULT 'admin',
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`last_login_at\` DATETIME NULL DEFAULT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_saas_admins_email\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    );
  }

  if (!(await tableExists("saas_tenants"))) {
    await dbExecute(
      `CREATE TABLE IF NOT EXISTS \`saas_tenants\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`slug\` VARCHAR(80) NOT NULL,
      \`name\` VARCHAR(190) NOT NULL,
      \`db_prefix\` VARCHAR(90) NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_saas_tenants_slug\` (\`slug\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    );
  }

  if (!(await tableExists("saas_admin_login_attempts"))) {
    await dbExecute(
      `CREATE TABLE IF NOT EXISTS \`saas_admin_login_attempts\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`email\` VARCHAR(190) NULL DEFAULT NULL,
      \`ip\` VARCHAR(45) NULL DEFAULT NULL,
      \`attempted_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`success\` TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      KEY \`idx_email_time\` (\`email\`, \`attempted_at\`),
      KEY \`idx_ip_time\` (\`ip\`, \`attempted_at\`),
      KEY \`idx_success_time\` (\`success\`, \`attempted_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    );
  }

  await addColumnIfMissing("saas_admins", "role", "`role` ENUM('owner','admin','viewer') NOT NULL DEFAULT 'admin' AFTER `password_hash`");
  await addColumnIfMissing("saas_admins", "is_active", "`is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `role`");
  await addColumnIfMissing("saas_admins", "last_login_at", "`last_login_at` DATETIME NULL DEFAULT NULL AFTER `is_active`");
  await addColumnIfMissing("saas_admins", "updated_at", "`updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`");
}

export async function isSaasBootstrapped(): Promise<boolean> {
  await ensureSaasAuthSchema();
  const rows = await dbQuery<RowDataPacket[]>("SELECT COUNT(*) AS count FROM `saas_admins`");
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function bootstrapSaasAdmin(input: { name: string; email: string; password: string }): Promise<SaasAdminSession> {
  await ensureSaasAuthSchema();
  if (await isSaasBootstrapped()) throw new Error("Admin SaaS gia configurato.");

  const name = input.name.trim() || "Admin";
  const email = normalizeEmail(input.email);
  const password = input.password;
  if (!email || !password) throw new Error("Email e password obbligatorie.");

  const hash = await bcrypt.hash(password, 10);
  const result = await dbExecute(
    "INSERT INTO `saas_admins`(name,email,password_hash,role,is_active) VALUES(?,?,?,?,1)",
    [name, email, hash, "owner"],
  );
  const user = await requireSaasAdminById(result.insertId);
  return { user, issuedAt: Date.now() };
}

export async function loginSaasAdmin(input: { email: string; password: string; ip: string }): Promise<LoginResult> {
  await ensureSaasAuthSchema();
  const email = normalizeEmail(input.email);
  const password = input.password;
  if (!email || !password) return { ok: false, error: "Email e password obbligatorie." };

  if (await isRateLimited(email, input.ip)) {
    return { ok: false, error: "Troppi tentativi di login. Riprova tra qualche minuto." };
  }

  const rows = await dbQuery<SaasAdminRow[]>("SELECT * FROM `saas_admins` WHERE email=? LIMIT 1", [email]);
  const row = rows[0];
  if (!row) {
    await recordLoginAttempt(email, input.ip, false);
    return { ok: false, error: "Credenziali non valide." };
  }
  if (Number(row.is_active ?? 1) !== 1) {
    await recordLoginAttempt(email, input.ip, false);
    return { ok: false, error: "Account admin disattivato." };
  }
  if (!await verifyPhpPassword(password, String(row.password_hash ?? ""))) {
    await recordLoginAttempt(email, input.ip, false);
    return { ok: false, error: "Credenziali non valide." };
  }

  await recordLoginAttempt(email, input.ip, true);
  await dbExecute("UPDATE `saas_admins` SET last_login_at=NOW() WHERE id=? LIMIT 1", [Number(row.id)]).catch(() => undefined);
  return { ok: true, session: { user: adminRowToUser(row), issuedAt: Date.now() } };
}

export async function setSaasAdminSessionCookie(session: SaasAdminSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(saasSessionCookieName(), signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSaasAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(saasSessionCookieName());
}

export async function currentSaasAdminSession(): Promise<SaasAdminSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(saasSessionCookieName())?.value;
  if (!raw) return null;

  const session = verifySession(raw);
  if (!session) return null;
  if (Date.now() - session.issuedAt > SESSION_TTL_SECONDS * 1000) return null;

  try {
    const user = await requireSaasAdminById(session.user.id);
    if (!user.isActive) return null;
    return { ...session, user };
  } catch {
    return null;
  }
}

export async function requireSaasAdminSession(): Promise<SaasAdminSession> {
  const session = await currentSaasAdminSession();
  if (!session) throw new Error("Accesso admin richiesto.");
  return session;
}

export function canManageSaasTenants(user: SaasAdminUser | null | undefined): boolean {
  return user?.role === "owner" || user?.role === "admin";
}

export function canManageSaasAdmins(user: SaasAdminUser | null | undefined): boolean {
  return user?.role === "owner";
}

export function saasSessionCookieName(): string {
  return `beautysuite_session_${tenantSessionSuffix(null, true)}`;
}

async function requireSaasAdminById(id: number): Promise<SaasAdminUser> {
  if (id <= 0) throw new Error("Admin SaaS non valido.");
  const rows = await dbQuery<SaasAdminRow[]>("SELECT * FROM `saas_admins` WHERE id=? LIMIT 1", [id]);
  const row = rows[0];
  if (!row) throw new Error("Admin SaaS non trovato.");
  return adminRowToUser(row);
}

async function isRateLimited(email: string, ip: string): Promise<boolean> {
  const identityClauses = [];
  const params: unknown[] = [LOGIN_RATE_LIMIT_WINDOW_SECONDS];
  if (email) {
    identityClauses.push("email = ?");
    params.push(email);
  }
  if (ip) {
    identityClauses.push("ip = ?");
    params.push(ip);
  }
  if (!identityClauses.length) return false;

  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM \`saas_admin_login_attempts\`
      WHERE success=0
        AND attempted_at >= (NOW() - (? * interval '1 second'))
        AND (${identityClauses.join(" OR ")})`,
    params,
  ).catch(() => []);
  return Number(rows[0]?.count ?? 0) >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await dbExecute(
    "INSERT INTO `saas_admin_login_attempts`(email,ip,attempted_at,success) VALUES(?,?,NOW(),?)",
    [email || null, ip || null, success ? 1 : 0],
  ).catch(() => undefined);
}

async function addColumnIfMissing(table: string, column: string, definition: string): Promise<void> {
  if (await columnExists(table, column)) return;
  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [table, column],
  );
  if (rows.length > 0) return;
  await dbExecute(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${definition}`).catch(() => undefined);
}

async function verifyPhpPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$2y$")) return bcrypt.compare(password, `$2a$${hash.slice(4)}`);
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) return bcrypt.compare(password, hash);
  return false;
}

function adminRowToUser(row: SaasAdminRow): SaasAdminUser {
  const role = normalizeRole(String(row.role ?? "admin"));
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role,
    isActive: Number(row.is_active ?? 1) === 1,
    lastLoginAt: dateString(row.last_login_at),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeRole(role: string): SaasAdminRole {
  return role === "owner" || role === "viewer" ? role : "admin";
}

function dateString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return mysqlDate(value);
  return String(value);
}

function signSession(session: SaasAdminSession): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(value: string): SaasAdminSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SaasAdminSession;
  } catch {
    return null;
  }
}

function sessionSecret(): string {
  return process.env.PRENODO_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "prenodo-local-session-secret";
}

function mysqlDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
