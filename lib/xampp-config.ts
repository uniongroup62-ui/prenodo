import fs from "node:fs";
import path from "node:path";

export type MysqlConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  charset: string;
};

export function loadMysqlConfig(): MysqlConfig | null {
  const envConfig = configFromEnv();
  if (envConfig) return envConfig;

  return configFromPhpFile();
}

export function xamppRoot(): string {
  return process.env.PRENODO_XAMPP_ROOT || "C:\\xampp\\htdocs";
}

function configFromEnv(): MysqlConfig | null {
  const host = process.env.PRENODO_DB_HOST || process.env.DB_HOST;
  const database = process.env.PRENODO_DB_NAME || process.env.DB_NAME;
  const user = process.env.PRENODO_DB_USER || process.env.DB_USER;
  const password = process.env.PRENODO_DB_PASS || process.env.DB_PASS || "";
  const charset = process.env.PRENODO_DB_CHARSET || process.env.DB_CHARSET || "utf8mb4";

  if (!host || !database || !user) return null;
  return { host, database, user, password, charset };
}

function configFromPhpFile(): MysqlConfig | null {
  const configPath = path.join(xamppRoot(), "config.php");
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, "utf8");
  const host = phpArrayValue(source, "host");
  const database = phpArrayValue(source, "name");
  const user = phpArrayValue(source, "user");
  const password = phpArrayValue(source, "pass") ?? "";
  const charset = phpArrayValue(source, "charset") ?? "utf8mb4";

  if (!host || !database || !user) return null;
  return { host, database, user, password, charset };
}

function phpArrayValue(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`['"]${escapedKey}['"]\\s*=>\\s*['"]([^'"]*)['"]`));
  return match?.[1] ?? null;
}
