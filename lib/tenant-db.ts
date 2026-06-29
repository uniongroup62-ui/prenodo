import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { normalizeTenantSlug, tenantPrefix } from "@/lib/tenant-runtime";
import { loadMysqlConfig } from "@/lib/xampp-config";

type TableMode = "prefixed" | "shared" | "base";

type TenantTable = {
  name: string;
  mode: TableMode;
  tenantId: number | null;
};

const globalForTenantDb = globalThis as typeof globalThis & {
  __prenodoMysqlPool?: Pool | null;
  __prenodoMysqlPoolError?: string | null;
};

let pool: Pool | null = globalForTenantDb.__prenodoMysqlPool ?? null;
let poolError: string | null = globalForTenantDb.__prenodoMysqlPoolError ?? null;
const tableExistsCache = new Map<string, boolean>();
const columnExistsCache = new Map<string, boolean>();
let sharedTenantTablesCache: boolean | null = null;
const tenantIdCache = new Map<string, number | null>();

export type DatabaseStatus = {
  available: boolean;
  configured: boolean;
  error?: string;
  mode?: "shared" | "prefixed" | "base";
};

export async function databaseStatus(slug = "centroesteticoelite"): Promise<DatabaseStatus> {
  const config = loadMysqlConfig();
  if (!config) return { available: false, configured: false, error: "Database non configurato." };

  try {
    const table = await tenantTable(slug, "users");
    return { available: true, configured: true, mode: table.mode };
  } catch (error) {
    return { available: false, configured: true, error: error instanceof Error ? error.message : "Database non disponibile." };
  }
}

export async function dbQuery<T extends RowDataPacket[] = RowDataPacket[]>(sql: string, params: unknown[] = []): Promise<T> {
  const activePool = getPool();
  const [rows] = await activePool.query<T>(sql, params as never[]);
  return rows;
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const activePool = getPool();
  const [result] = await activePool.execute<ResultSetHeader>(sql, params as never[]);
  return result;
}

export async function tenantTable(slug: string, baseTable: string): Promise<TenantTable> {
  const normalizedSlug = normalizeTenantSlug(slug) ?? "";
  const safeBase = sanitizeIdentifier(baseTable);
  if (!safeBase) throw new Error("Tabella non valida.");

  if (await usesSharedTenantTables()) {
    return { name: safeBase, mode: "shared", tenantId: await tenantIdForSlug(normalizedSlug) };
  }

  const prefixed = `${tenantPrefix(normalizedSlug)}${safeBase}`;
  if (normalizedSlug && await tableExists(prefixed)) return { name: prefixed, mode: "prefixed", tenantId: null };
  if (await tableExists(safeBase)) return { name: safeBase, mode: "base", tenantId: null };

  throw new Error(`Tabella ${safeBase} non trovata.`);
}

export async function tenantSelect<T extends RowDataPacket = RowDataPacket>({
  slug,
  table,
  columns = "*",
  where = "",
  params = [],
  orderBy = "",
  limit,
}: {
  slug: string;
  table: string;
  columns?: string;
  where?: string;
  params?: unknown[];
  orderBy?: string;
  limit?: number;
}): Promise<T[]> {
  const target = await tenantTable(slug, table);
  const clauses: string[] = [];
  const queryParams = [...params];

  if (where.trim()) clauses.push(`(${where})`);
  if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    queryParams.unshift(target.tenantId ?? 0);
  }

  const sql = [
    `SELECT ${columns} FROM ${quoteIdentifier(target.name)}`,
    clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    orderBy.trim() ? `ORDER BY ${orderBy}` : "",
    limit && limit > 0 ? `LIMIT ${Math.floor(limit)}` : "",
  ].filter(Boolean).join(" ");

  return dbQuery<T[]>(sql, queryParams);
}

export async function tenantInsert(table: TenantTable, values: Record<string, unknown>): Promise<number> {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (table.mode === "shared" && table.tenantId && !entries.some(([key]) => key === "tenant_id") && await columnExists(table.name, "tenant_id")) {
    entries.unshift(["tenant_id", table.tenantId]);
  }

  const columns = entries.map(([key]) => quoteIdentifier(key)).join(",");
  const placeholders = entries.map(() => "?").join(",");
  const params = entries.map(([, value]) => value);
  const result = await dbExecute(`INSERT INTO ${quoteIdentifier(table.name)} (${columns}) VALUES (${placeholders})`, params);
  return result.insertId;
}

export async function tenantUpdate({
  slug,
  table,
  id,
  values,
}: {
  slug: string;
  table: string;
  id: number;
  values: Record<string, unknown>;
}): Promise<number> {
  const target = await tenantTable(slug, table);
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (!entries.length) return 0;

  const clauses = [`id = ?`];
  const params = [...entries.map(([, value]) => value), id];
  if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
    clauses.push("tenant_id = ?");
    params.push(target.tenantId ?? 0);
  }

  const assignments = entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(",");
  const result = await dbExecute(`UPDATE ${quoteIdentifier(target.name)} SET ${assignments} WHERE ${clauses.join(" AND ")}`, params);
  return result.affectedRows;
}

export async function tenantDelete({ slug, table, id }: { slug: string; table: string; id: number }): Promise<number> {
  const target = await tenantTable(slug, table);
  const clauses = [`id = ?`];
  const params: unknown[] = [id];
  if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
    clauses.push("tenant_id = ?");
    params.push(target.tenantId ?? 0);
  }

  const result = await dbExecute(`DELETE FROM ${quoteIdentifier(target.name)} WHERE ${clauses.join(" AND ")}`, params);
  return result.affectedRows;
}

export async function tableExists(table: string): Promise<boolean> {
  const safe = sanitizeIdentifier(table);
  if (!safe) return false;
  if (tableExistsCache.has(safe)) return tableExistsCache.get(safe) ?? false;

  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
    [safe],
  );
  const exists = rows.length > 0;
  tableExistsCache.set(safe, exists);
  return exists;
}

export async function columnExists(table: string, column: string): Promise<boolean> {
  const safeTable = sanitizeIdentifier(table);
  const safeColumn = sanitizeIdentifier(column);
  if (!safeTable || !safeColumn) return false;
  const key = `${safeTable}.${safeColumn}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key) ?? false;

  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [safeTable, safeColumn],
  );
  const exists = rows.length > 0;
  columnExistsCache.set(key, exists);
  return exists;
}

export async function usesSharedTenantTables(): Promise<boolean> {
  if (sharedTenantTablesCache !== null) return sharedTenantTablesCache;
  sharedTenantTablesCache =
    await columnExists("users", "tenant_id") &&
    await columnExists("permissions", "tenant_id") &&
    await columnExists("role_permissions", "tenant_id");
  return sharedTenantTablesCache;
}

export async function tenantIdForSlug(slug: string): Promise<number | null> {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) return null;
  if (tenantIdCache.has(normalizedSlug)) return tenantIdCache.get(normalizedSlug) ?? null;

  if (!await tableExists("saas_tenants")) {
    tenantIdCache.set(normalizedSlug, null);
    return null;
  }

  const rows = await dbQuery<RowDataPacket[]>("SELECT id FROM saas_tenants WHERE slug = ? LIMIT 1", [normalizedSlug]);
  const id = Number(rows[0]?.id ?? 0) || null;
  tenantIdCache.set(normalizedSlug, id);
  return id;
}

export function quoteIdentifier(identifier: string): string {
  const safe = sanitizeIdentifier(identifier);
  if (!safe) throw new Error("Identificatore SQL non valido.");
  return `\`${safe.replace(/`/g, "``")}\``;
}

export function sanitizeIdentifier(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9_]/g, "");
}

function getPool(): Pool {
  if (pool) return pool;
  if (poolError) throw new Error(poolError);

  const config = loadMysqlConfig();
  if (!config) {
    poolError = "Database non configurato.";
    globalForTenantDb.__prenodoMysqlPoolError = poolError;
    throw new Error(poolError);
  }

  pool = mysql.createPool({
    host: config.host,
    database: config.database,
    user: config.user,
    password: config.password,
    charset: config.charset,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 1,
    idleTimeout: 10000,
    timezone: "+02:00",
    namedPlaceholders: false,
  });
  globalForTenantDb.__prenodoMysqlPool = pool;

  return pool;
}
