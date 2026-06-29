// Apply a .sql file to the Supabase Postgres. Reads connection string from
// SUPA_URL (or PRENODO_DATABASE_URL). Must run from an env with network access
// to Supabase (e.g. the PowerShell tool, not the sandboxed Bash tool).
//
//   SUPA_URL=postgres://... node db/tools/apply-sql.mjs db/schema.sql
//
// Multiple statements run as one implicit transaction (all-or-nothing).

import fs from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("usage: apply-sql.mjs <file.sql>"); process.exit(2); }
const cs = process.env.SUPA_URL || process.env.PRENODO_DATABASE_URL;
if (!cs) { console.error("set SUPA_URL"); process.exit(2); }

const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
try {
  await client.connect();
  await client.query(sql);
  const t = await client.query("select count(*)::int n from information_schema.tables where table_schema='public'");
  const tr = await client.query("select count(*)::int n from information_schema.triggers where trigger_schema='public'");
  console.log(`APPLIED ${file}`);
  console.log(`public tables: ${t.rows[0].n}`);
  console.log(`triggers: ${tr.rows[0].n}`);
  await client.end();
} catch (e) {
  console.error("APPLY FAILED:", e.message);
  if (e.position) console.error("at position:", e.position, "-> ...", sql.slice(Math.max(0, e.position - 120), Number(e.position) + 40).replace(/\n/g, " "));
  process.exit(1);
}
