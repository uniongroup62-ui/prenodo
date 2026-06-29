// End-to-end public booking flow test against the running Next app + Supabase.
// Walks /api/booking: context -> slots -> hold -> confirm, then checks the
// appointment landed in Supabase and cleans it up.
//   SUPA_URL=... node db/tools/test-booking.mjs
import pg from "pg";

const BASE = "http://localhost:3000";
const SLUG = "centroesteticoelite";
const MARK = "ZZ_BOOK_TEST";

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
const J = (r) => r.json();
const post = (body) => fetch(`${BASE}/api/booking`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(J);

const ctx = await fetch(`${BASE}/api/booking?action=context&slug=${SLUG}`).then(J);
const c = ctx.context ?? ctx;
const loc = (c.locations ?? [])[0];
const svc = (c.services ?? [])[0];
console.log("context:", ctx.sourceMode ?? ctx.source, "| location:", loc?.id, loc?.name, "| service:", svc?.id, svc?.name);
if (!loc || !svc) { console.log("no location/service — abort"); process.exit(1); }

const date = tomorrow();
const slotsUrl = `${BASE}/api/booking?action=slots&slug=${SLUG}&date=${date}&service_ids=${svc.id}&location_id=${loc.id}`;
const slotsRes = await fetch(slotsUrl).then(J);
const slots = Array.isArray(slotsRes.slots) ? slotsRes.slots : [];
const avail = slots.filter((s) => (typeof s === "object" && s ? s.available !== false : true));
const slot = avail[0];
const slotTime = typeof slot === "string" ? slot : slot?.time ?? slot?.start ?? null;
console.log(`slots for ${date}:`, slots.length, "| available:", avail.length, "| first available:", slotTime);
if (!slotTime) { console.log("no available slot — abort (closed day or no availability)"); process.exit(1); }

const ownerKey = "zztest-owner-" + date.replace(/-/g, "");
const hold = await post({ action: "hold", slug: SLUG, location_id: loc.id, service_ids: [svc.id], date, time: slotTime, owner_key: ownerKey });
console.log("hold:", hold.sourceMode, "| token:", (hold.hold?.token ?? "none").slice(0, 12));
const holdToken = hold.hold?.token ?? hold.token ?? null;

const confirm = await post({
  action: "confirm", slug: SLUG, location_id: loc.id, service_ids: [svc.id], staff_id: 0,
  date, time: slotTime, hold_token: holdToken,
  client_name: `${MARK} Guest`, client_email: "zzbooktest@example.com", client_phone: "0000000000",
  owner_key: ownerKey,
});
console.log("confirm:", JSON.stringify(confirm).slice(0, 240));

// verify + cleanup in Supabase
const db = new pg.Client({ connectionString: process.env.SUPA_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const found = await db.query(
  `SELECT a.id, a.starts_at, a.status FROM appointments a
   JOIN clients c ON c.tenant_id=a.tenant_id AND c.id=a.client_id
   WHERE a.tenant_id=25 AND c.full_name LIKE $1 ORDER BY a.id DESC LIMIT 5`, [MARK + "%"]
);
console.log("appointments created (by test guest):", found.rows.length, JSON.stringify(found.rows));
// cleanup: delete test appointments + their child rows + the test client
for (const row of found.rows) {
  await db.query("DELETE FROM appointment_services WHERE tenant_id=25 AND appointment_id=$1", [row.id]).catch(() => {});
  await db.query("DELETE FROM appointment_staff WHERE tenant_id=25 AND appointment_id=$1", [row.id]).catch(() => {});
  await db.query("DELETE FROM appointment_locations WHERE tenant_id=25 AND appointment_id=$1", [row.id]).catch(() => {});
  await db.query("DELETE FROM appointment_segments WHERE tenant_id=25 AND appointment_id=$1", [row.id]).catch(() => {});
  await db.query("DELETE FROM appointments WHERE tenant_id=25 AND id=$1", [row.id]).catch(() => {});
}
const delC = await db.query("DELETE FROM clients WHERE tenant_id=25 AND full_name LIKE $1", [MARK + "%"]);
await db.query("DELETE FROM appointment_holds WHERE tenant_id=25 AND owner_key=$1", [ownerKey]).catch(() => {});
console.log(`cleanup: removed ${found.rows.length} appts + ${delC.rowCount} test clients`);
await db.end();
