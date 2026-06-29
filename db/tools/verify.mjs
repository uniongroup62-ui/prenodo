// Sanity-check the migrated Supabase DB. Run via PowerShell (network).
//   SUPA_URL=postgres://... node db/tools/verify.mjs
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPA_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const show = async (label, sql, args = []) => {
  try { const r = await c.query(sql, args); console.log(`\n# ${label}`); console.table(r.rows); }
  catch (e) { console.log(`\n# ${label} -> ERROR: ${e.message}`); }
};
await show("users", "SELECT id,tenant_id,email,substr(password_hash,1,7) AS hash7,role FROM users ORDER BY tenant_id");
await show("saas_tenants", "SELECT id,slug,status FROM saas_tenants ORDER BY id");
await show("businesses.logo_blob", "SELECT id,tenant_id,length(logo_blob) AS blob_bytes FROM businesses ORDER BY tenant_id");
await show("permissions sample", "SELECT count(*)::int AS permissions FROM permissions");
// tenant trigger test (rolled back)
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL app.tenant_id = '25'");
  const r = await c.query("INSERT INTO cost_categories (name) VALUES ('__trg_test__') RETURNING tenant_id, id");
  console.log("\n# tenant trigger test (rolled back): inserted tenant_id =", r.rows[0].tenant_id, "(expected 25)");
  await c.query("ROLLBACK");
} catch (e) { try { await c.query("ROLLBACK"); } catch {} console.log("\n# tenant trigger test -> ERROR:", e.message); }
await c.end();
