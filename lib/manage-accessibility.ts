import "server-only";

import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { columnExists, dbExecute, dbQuery, tableExists, tenantSelect, tenantTable } from "@/lib/tenant-db";
import { invalidateManagePasswordResets } from "@/lib/manage-password-reset";
import { normalizeTenantSlug } from "@/lib/tenant-runtime";

const EMAIL_CODE_TTL_SECONDS = 15 * 60;
const EMAIL_CODE_RESEND_SECONDS = 60;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

export type EmailVerificationPending = {
  id: number;
  email: string;
  expiresAt: string;
  createdAt: string;
  attemptCount: number;
  resendWaitSeconds: number;
};

export type EmailCodeResult = {
  ok: true;
  message: string;
  pending: EmailVerificationPending | null;
  verificationCode?: string;
};

export async function getEmailVerificationPending(
  slug: string,
  userId: number,
  cleanupExpired = true,
): Promise<EmailVerificationPending | null> {
  const tenantSlug = normalizeTenantSlug(slug) ?? "";
  if (!tenantSlug || userId <= 0) return null;
  const table = await ensureEmailVerificationTable(tenantSlug);
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT id,new_email,code_hash,expires_at,created_at,attempt_count,last_attempt_at FROM \`${table.name}\` WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT 1`,
    params,
  ).catch(() => []);
  const row = rows[0];
  if (!row) return null;
  if (cleanupExpired && isExpired(row.expires_at)) {
    await deletePendingEmailVerification(tenantSlug, userId);
    return null;
  }
  return mapPending(row);
}

export async function requestCurrentEmailVerification({
  slug,
  userId,
  email,
}: {
  slug: string;
  userId: number;
  email: string;
}): Promise<EmailCodeResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) throw new Error("Email non valida.");
  await ensureEmailCodeCooldown(slug, userId);
  return storeAndReturnCode({ slug, userId, email: normalizedEmail, message: "Codice inviato alla tua email." });
}

export async function requestEmailChange({
  slug,
  userId,
  currentEmail,
  newEmail,
  currentPassword,
}: {
  slug: string;
  userId: number;
  currentEmail: string;
  newEmail: string;
  currentPassword: string;
}): Promise<EmailCodeResult> {
  const normalizedCurrent = normalizeEmail(currentEmail);
  const normalizedNew = normalizeEmail(newEmail);
  if (!isValidEmail(normalizedNew)) throw new Error("Email non valida.");
  if (normalizedCurrent === normalizedNew) throw new Error("L email e gia questa.");
  await assertCurrentPassword(slug, userId, currentPassword, "Inserisci la password attuale per cambiare email.");
  await ensureEmailAvailable(slug, userId, normalizedNew, normalizedCurrent);
  await ensureEmailCodeCooldown(slug, userId);
  return storeAndReturnCode({ slug, userId, email: normalizedNew, message: "Codice inviato alla nuova email." });
}

export async function resendEmailCode({
  slug,
  userId,
  currentEmail,
}: {
  slug: string;
  userId: number;
  currentEmail: string;
}): Promise<EmailCodeResult> {
  const pending = await getEmailVerificationPending(slug, userId, false);
  if (!pending) throw new Error("Nessuna verifica email in corso.");
  if (pending.resendWaitSeconds > 0) {
    throw new Error(`Attendi ${pending.resendWaitSeconds} secondi prima di richiedere un nuovo codice.`);
  }

  const targetEmail = normalizeEmail(pending.email);
  if (!isValidEmail(targetEmail)) {
    await deletePendingEmailVerification(slug, userId);
    throw new Error("Email non valida: richiedi un nuovo codice.");
  }

  const normalizedCurrent = normalizeEmail(currentEmail);
  if (targetEmail !== normalizedCurrent) {
    await ensureEmailAvailable(slug, userId, targetEmail, normalizedCurrent);
  }

  return storeAndReturnCode({ slug, userId, email: targetEmail, message: "Codice reinviato." });
}

export async function confirmEmailCode({
  slug,
  userId,
  currentEmail,
  code,
}: {
  slug: string;
  userId: number;
  currentEmail: string;
  code: string;
}): Promise<{ ok: true; email: string; verifiedAt: string; message: string }> {
  const tenantSlug = normalizeTenantSlug(slug) ?? "";
  const normalizedCode = code.trim();
  if (!normalizedCode) throw new Error("Inserisci il codice.");
  const pending = await rawPendingRow(tenantSlug, userId);
  if (!pending) throw new Error("Nessuna richiesta di cambio email attiva.");
  if (isExpired(pending.expires_at)) {
    await deletePendingEmailVerification(tenantSlug, userId);
    throw new Error("Codice scaduto: richiedi un nuovo codice.");
  }
  if (Number(pending.attempt_count ?? 0) >= EMAIL_CODE_MAX_ATTEMPTS) {
    await deletePendingEmailVerification(tenantSlug, userId);
    throw new Error("Troppi tentativi non validi. Richiedi un nuovo codice.");
  }
  if (String(pending.code_hash ?? "") !== codeHash(normalizedCode)) {
    await badEmailCodeAttempt(tenantSlug, userId, pending);
    throw new Error("Codice non valido.");
  }

  const newEmail = normalizeEmail(String(pending.new_email ?? ""));
  const normalizedCurrent = normalizeEmail(currentEmail);
  if (!isValidEmail(newEmail)) {
    await deletePendingEmailVerification(tenantSlug, userId);
    throw new Error("Email non valida: richiedi un nuovo codice.");
  }
  if (newEmail !== normalizedCurrent) await ensureEmailAvailable(tenantSlug, userId, newEmail, normalizedCurrent);

  const users = await tenantTable(tenantSlug, "users");
  const userClauses = ["id = ?"];
  const userParams: unknown[] = newEmail === normalizedCurrent
    ? [userId]
    : [newEmail, userId];
  if (users.mode === "shared" && await columnExists(users.name, "tenant_id")) {
    userClauses.push("tenant_id = ?");
    userParams.push(users.tenantId ?? 0);
  }
  const verifiedAt = sqlNow();
  if (newEmail === normalizedCurrent) {
    await dbExecute(`UPDATE \`${users.name}\` SET email_verified_at = ? WHERE ${userClauses.join(" AND ")} LIMIT 1`, [verifiedAt, ...userParams]);
  } else {
    await dbExecute(`UPDATE \`${users.name}\` SET email = ?, email_verified_at = ? WHERE ${userClauses.join(" AND ")} LIMIT 1`, [newEmail, verifiedAt, ...userParams.slice(1)]);
    await syncStaffEmail(tenantSlug, normalizedCurrent, newEmail);
  }
  await deletePendingEmailVerification(tenantSlug, userId);
  await invalidateManagePasswordResets(tenantSlug, userId);
  return { ok: true, email: newEmail, verifiedAt, message: "Email verificata." };
}

async function storeAndReturnCode({
  slug,
  userId,
  email,
  message,
}: {
  slug: string;
  userId: number;
  email: string;
  message: string;
}): Promise<EmailCodeResult> {
  const tenantSlug = normalizeTenantSlug(slug) ?? "";
  const code = String(randomInt(100000, 1000000));
  const table = await ensureEmailVerificationTable(tenantSlug);
  await deletePendingEmailVerification(tenantSlug, userId);
  const includeTenant = table.mode === "shared" && await columnExists(table.name, "tenant_id");
  await dbExecute(
    `INSERT INTO \`${table.name}\` (${[
      includeTenant ? "`tenant_id`" : "",
      "`user_id`",
      "`new_email`",
      "`code_hash`",
      "`expires_at`",
      "`attempt_count`",
    ].filter(Boolean).join(",")}) VALUES (${[
      includeTenant ? "?" : "",
      "?",
      "?",
      "?",
      `DATE_ADD(NOW(), INTERVAL ${EMAIL_CODE_TTL_SECONDS} SECOND)`,
      "0",
    ].filter(Boolean).join(",")})`,
    [...(includeTenant ? [table.tenantId ?? 0] : []), userId, email, codeHash(code)],
  );
  return {
    ok: true,
    message,
    pending: await getEmailVerificationPending(tenantSlug, userId, false),
    verificationCode: exposeVerificationCode() ? code : undefined,
  };
}

async function ensureEmailCodeCooldown(slug: string, userId: number): Promise<void> {
  const pending = await getEmailVerificationPending(slug, userId, true);
  if (!pending || pending.resendWaitSeconds <= 0) return;
  throw new Error(`Attendi ${pending.resendWaitSeconds} secondi prima di richiedere un nuovo codice.`);
}

async function ensureEmailVerificationTable(slug: string): Promise<{ name: string; mode: string; tenantId: number | null }> {
  const table = await tenantTable(slug, "user_email_verifications").catch(async () => {
    const users = await tenantTable(slug, "users");
    return {
      name: users.mode === "prefixed" ? `${users.name.replace(/users$/, "")}user_email_verifications` : "user_email_verifications",
      mode: users.mode,
      tenantId: users.tenantId,
    };
  });
  const tenantColumn = table.mode === "shared" ? "`tenant_id` INT(11) NULL DEFAULT NULL," : "";
  await dbExecute(
    `CREATE TABLE IF NOT EXISTS \`${table.name}\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      ${tenantColumn}
      \`user_id\` INT(11) NOT NULL,
      \`new_email\` VARCHAR(190) NOT NULL,
      \`code_hash\` CHAR(64) NOT NULL,
      \`expires_at\` DATETIME NOT NULL,
      \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      \`attempt_count\` INT(11) NOT NULL DEFAULT 0,
      \`last_attempt_at\` DATETIME NULL DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_user_email_verifications_user\` (\`user_id\`),
      KEY \`idx_user_email_verifications_exp\` (\`expires_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );
  return table;
}

async function rawPendingRow(slug: string, userId: number): Promise<RowDataPacket | null> {
  const table = await ensureEmailVerificationTable(slug);
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT id,new_email,code_hash,expires_at,created_at,attempt_count,last_attempt_at FROM \`${table.name}\` WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

async function deletePendingEmailVerification(slug: string, userId: number): Promise<void> {
  const table = await ensureEmailVerificationTable(slug);
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  await dbExecute(`DELETE FROM \`${table.name}\` WHERE ${clauses.join(" AND ")}`, params).catch(() => undefined);
}

async function badEmailCodeAttempt(slug: string, userId: number, row: RowDataPacket): Promise<void> {
  const table = await ensureEmailVerificationTable(slug);
  const rowId = Number(row.id ?? 0);
  const clauses = ["id = ?", "user_id = ?"];
  const params: unknown[] = [rowId, userId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.push("tenant_id = ?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(
    `UPDATE \`${table.name}\` SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE ${clauses.join(" AND ")}`,
    params,
  ).catch(() => undefined);
  if (Number(row.attempt_count ?? 0) + 1 >= EMAIL_CODE_MAX_ATTEMPTS) {
    await deletePendingEmailVerification(slug, userId);
  }
}

async function assertCurrentPassword(slug: string, userId: number, password: string, emptyMessage: string): Promise<void> {
  if (!password.trim()) throw new Error(emptyMessage);
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "users",
    columns: "id,password_hash",
    where: "id = ?",
    params: [userId],
    limit: 1,
  });
  const user = rows[0];
  if (!user || !await verifyPhpPassword(password, String(user.password_hash ?? ""))) {
    throw new Error("Password attuale non corretta.");
  }
}

async function ensureEmailAvailable(slug: string, userId: number, email: string, currentEmail: string): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "users",
    columns: "id",
    where: "LOWER(email) = ? AND id <> ?",
    params: [email, userId],
    limit: 1,
  }).catch(() => []);
  if (rows.length > 0 || await staffEmailInUse(slug, email, currentEmail)) {
    throw new Error("Email gia utilizzata da un altro account o operatore.");
  }
}

async function staffEmailInUse(slug: string, email: string, currentEmail: string): Promise<boolean> {
  if (!await tableExists("staff").catch(() => false)) return false;
  const staff = await tenantTable(slug, "staff").catch(() => null);
  if (!staff || !await columnExists(staff.name, "email")) return false;
  const hasFullName = await columnExists(staff.name, "full_name");
  const clauses = ["LOWER(email) = ?", "LOWER(COALESCE(email,'')) <> ?"];
  const params: unknown[] = [email, currentEmail];
  if (hasFullName) clauses.push("COALESCE(full_name,'') <> 'SSO'");
  if (staff.mode === "shared" && await columnExists(staff.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(staff.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${staff.name}\` WHERE ${clauses.join(" AND ")}`, params).catch(() => []);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function syncStaffEmail(slug: string, oldEmail: string, newEmail: string): Promise<void> {
  if (oldEmail === newEmail) return;
  const staff = await tenantTable(slug, "staff").catch(() => null);
  if (!staff || !await columnExists(staff.name, "email")) return;
  const hasFullName = await columnExists(staff.name, "full_name");
  const clauses = ["LOWER(email) = ?"];
  const params: unknown[] = [newEmail, oldEmail];
  if (hasFullName) clauses.push("COALESCE(full_name,'') <> 'SSO'");
  if (staff.mode === "shared" && await columnExists(staff.name, "tenant_id")) {
    clauses.push("tenant_id = ?");
    params.push(staff.tenantId ?? 0);
  }
  await dbExecute(`UPDATE \`${staff.name}\` SET email = ? WHERE ${clauses.join(" AND ")}`, params).catch(() => undefined);
}

function mapPending(row: RowDataPacket): EmailVerificationPending {
  const createdAt = String(row.created_at ?? "");
  return {
    id: Number(row.id ?? 0),
    email: String(row.new_email ?? ""),
    expiresAt: String(row.expires_at ?? ""),
    createdAt,
    attemptCount: Number(row.attempt_count ?? 0),
    resendWaitSeconds: resendWaitSeconds(createdAt),
  };
}

function resendWaitSeconds(createdAt: string): number {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return 0;
  const elapsed = Math.floor((Date.now() - createdMs) / 1000);
  return Math.max(0, EMAIL_CODE_RESEND_SECONDS - elapsed);
}

function isExpired(value: unknown): boolean {
  const expiresMs = Date.parse(String(value ?? ""));
  return Number.isFinite(expiresMs) && expiresMs < Date.now();
}

function codeHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyPhpPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$2y$")) return bcrypt.compare(password, `$2a$${hash.slice(4)}`);
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) return bcrypt.compare(password, hash);
  return false;
}

function exposeVerificationCode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PRENODO_EXPOSE_EMAIL_CODE === "1";
}

function sqlNow(): string {
  const date = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
