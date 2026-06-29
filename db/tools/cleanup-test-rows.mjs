// Remove any leftover write-path test rows (marker ZZ_NEXT_TEST) from tenant 25.
// Run via PowerShell (network).  SUPA_URL=... node db/tools/cleanup-test-rows.mjs
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPA_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const M = "ZZ_NEXT_TEST%";
const T = 25;
let total = 0;
const del = async (label, sql, args) => {
  try { const r = await c.query(sql, args); if (r.rowCount) { console.log(`  deleted ${r.rowCount} from ${label}`); total += r.rowCount; } }
  catch (e) { console.log(`  ${label}: ${e.message}`); }
};
// sale_items of test sales first, then sales
await del("sale_items", `DELETE FROM sale_items WHERE tenant_id=$1 AND (item_name LIKE $2 OR sale_id IN (SELECT id FROM sales WHERE tenant_id=$1 AND (COALESCE(notes,'') LIKE $2 OR COALESCE(operator_name,'') LIKE $2)))`, [T, M]);
await del("sales", `DELETE FROM sales WHERE tenant_id=$1 AND (COALESCE(notes,'') LIKE $2 OR COALESCE(operator_name,'') LIKE $2)`, [T, M]);
await del("clients", `DELETE FROM clients WHERE tenant_id=$1 AND COALESCE(full_name,'') LIKE $2`, [T, M]);
await del("services", `DELETE FROM services WHERE tenant_id=$1 AND COALESCE(name,'') LIKE $2`, [T, M]);
await del("products", `DELETE FROM products WHERE tenant_id=$1 AND COALESCE(name,'') LIKE $2`, [T, M]);
console.log(`cleanup done, ${total} rows removed`);
await c.end();
