import "server-only";

import type { RowDataPacket } from "@/lib/tenant-db";
import { dbQuery, quoteIdentifier, tenantTable } from "@/lib/tenant-db";

// DB-backed port of the analytics in app/pages/reports.php (Statistiche / Report):
// a date-filtered revenue summary + daily series + top clients / services / products
// / operators, and the appointment count. Cancelled sales are excluded. All queries
// are tenant-scoped (tenant_id filters + tenant-joined), no cross-tenant raw joins.

const CANCELLED_SALE_STATES = ["cancelled", "canceled", "annullata", "annullato"];
const CANCELLED_APPT_STATES = ["canceled", "cancelled", "annullato", "annullata", "no_show"];

export type ReportRow = { name: string; revenue: number; qty?: number; saleCount?: number };
export type ManageReports = {
  from: string;
  to: string;
  summary: { soldRevenue: number; grossRevenue: number; saleCount: number; servedClients: number; averageTicket: number; appointmentCount: number };
  comparison: { from: string; to: string; soldRevenue: number; saleCount: number; deltaPct: number } | null;
  daily: { day: string; revenue: number; saleCount: number }[];
  topClients: { clientId: number; name: string; revenue: number; saleCount: number }[];
  topServices: ReportRow[];
  topProducts: ReportRow[];
  operators: { name: string; revenue: number; saleCount: number }[];
};

function money(v: unknown): number {
  return Math.round((Number(v ?? 0) + Number.EPSILON) * 100) / 100;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(iso: string, days: number): string {
  return ymd(new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000));
}

// Sold-revenue summary for a [from, toExclusive) window (tenant + location scoped).
async function salesSummary(salesName: string, tid: number, from: string, toExclusive: string, locClause: string, locParams: unknown[]): Promise<{ sold: number; gross: number; cnt: number; clients: number }> {
  const cph = CANCELLED_SALE_STATES.map(() => "?").join(",");
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT COALESCE(SUM(s.total),0) sold, COALESCE(SUM(s.subtotal),0) gross, COUNT(*) cnt, COUNT(DISTINCT s.client_id) clients
       FROM ${quoteIdentifier(salesName)} s
      WHERE s.tenant_id = ? AND LOWER(s.status) NOT IN (${cph}) AND s.sale_date >= ? AND s.sale_date < ?${locClause}`,
    [tid, ...CANCELLED_SALE_STATES, from, toExclusive, ...locParams],
  ).catch(() => [] as RowDataPacket[]);
  const r = rows[0] ?? {};
  return { sold: money(r.sold), gross: money(r.gross), cnt: Number(r.cnt ?? 0), clients: Number(r.clients ?? 0) };
}

export async function getManageReports(slug: string, fromRaw: string, toRaw: string, locationId = 0, compare = false): Promise<ManageReports> {
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : ymd(monthStart);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : ymd(today);
  const toExclusive = addDaysYmd(to, 1);

  const sales = await tenantTable(slug, "sales");
  const tid = sales.tenantId ?? 0;
  const locClause = locationId > 0 ? " AND s.location_id = ?" : "";
  const locParams: unknown[] = locationId > 0 ? [locationId] : [];
  const cph = CANCELLED_SALE_STATES.map(() => "?").join(",");
  const baseWhere = `s.tenant_id = ? AND LOWER(s.status) NOT IN (${cph}) AND s.sale_date >= ? AND s.sale_date < ?${locClause}`;
  const baseParams = [tid, ...CANCELLED_SALE_STATES, from, toExclusive, ...locParams];

  const summaryRow = await salesSummary(sales.name, tid, from, toExclusive, locClause, locParams);

  // Daily revenue series.
  const dailyRows = await dbQuery<RowDataPacket[]>(
    `SELECT s.sale_date::date d, COALESCE(SUM(s.total),0) rev, COUNT(*) cnt FROM ${quoteIdentifier(sales.name)} s WHERE ${baseWhere} GROUP BY d ORDER BY d ASC`,
    baseParams,
  ).catch(() => [] as RowDataPacket[]);

  // Top clients by revenue.
  const clientsTable = await tenantTable(slug, "clients");
  const topClientRows = await dbQuery<RowDataPacket[]>(
    `SELECT s.client_id, COALESCE(c.full_name,'—') name, COALESCE(SUM(s.total),0) rev, COUNT(*) cnt
       FROM ${quoteIdentifier(sales.name)} s LEFT JOIN ${quoteIdentifier(clientsTable.name)} c ON c.id = s.client_id AND c.tenant_id = s.tenant_id
      WHERE ${baseWhere} AND s.client_id IS NOT NULL
      GROUP BY s.client_id, c.full_name ORDER BY rev DESC, cnt DESC LIMIT 10`,
    baseParams,
  ).catch(() => [] as RowDataPacket[]);

  // Top services + products (sale_items joined to in-range sales).
  const itemsTable = await tenantTable(slug, "sale_items");
  const itemRows = await dbQuery<RowDataPacket[]>(
    `SELECT si.item_type type, si.item_name name, COALESCE(SUM(si.line_total),0) rev, COALESCE(SUM(si.qty),0) qty
       FROM ${quoteIdentifier(itemsTable.name)} si JOIN ${quoteIdentifier(sales.name)} s ON s.id = si.sale_id AND s.tenant_id = si.tenant_id
      WHERE si.tenant_id = ? AND ${baseWhere}
      GROUP BY si.item_type, si.item_name ORDER BY rev DESC`,
    [tid, ...baseParams],
  ).catch(() => [] as RowDataPacket[]);

  // Operator performance.
  const opRows = await dbQuery<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(s.operator_name,''),'Non indicato') op, COALESCE(SUM(s.total),0) rev, COUNT(*) cnt
       FROM ${quoteIdentifier(sales.name)} s WHERE ${baseWhere} GROUP BY op ORDER BY rev DESC, cnt DESC LIMIT 20`,
    baseParams,
  ).catch(() => [] as RowDataPacket[]);

  // Appointment count in range.
  const appt = await tenantTable(slug, "appointments");
  const aph = CANCELLED_APPT_STATES.map(() => "?").join(",");
  const apptRows = await dbQuery<RowDataPacket[]>(
    `SELECT COUNT(*) cnt FROM ${quoteIdentifier(appt.name)} a WHERE a.tenant_id = ? AND a.starts_at >= ? AND a.starts_at < ? AND LOWER(a.status) NOT IN (${aph})`,
    [appt.tenantId ?? 0, from, toExclusive, ...CANCELLED_APPT_STATES],
  ).catch(() => [] as RowDataPacket[]);
  const appointmentCount = Number(apptRows[0]?.cnt ?? 0);

  // Previous-period comparison (same length, immediately before `from`).
  let comparison: ManageReports["comparison"] = null;
  if (compare) {
    const lenDays = Math.max(1, Math.round((Date.parse(`${toExclusive}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000));
    const prevToExclusive = from;
    const prevFrom = addDaysYmd(from, -lenDays);
    const prev = await salesSummary(sales.name, tid, prevFrom, prevToExclusive, locClause, locParams);
    const deltaPct = prev.sold > 0 ? Math.round(((summaryRow.sold - prev.sold) / prev.sold) * 1000) / 10 : summaryRow.sold > 0 ? 100 : 0;
    comparison = { from: prevFrom, to: addDaysYmd(prevToExclusive, -1), soldRevenue: prev.sold, saleCount: prev.cnt, deltaPct };
  }

  return {
    from,
    to,
    summary: {
      soldRevenue: summaryRow.sold,
      grossRevenue: summaryRow.gross,
      saleCount: summaryRow.cnt,
      servedClients: summaryRow.clients,
      averageTicket: summaryRow.cnt > 0 ? money(summaryRow.sold / summaryRow.cnt) : 0,
      appointmentCount,
    },
    comparison,
    daily: dailyRows.map((r) => ({ day: typeof r.d === "string" ? r.d.slice(0, 10) : ymd(new Date(String(r.d))), revenue: money(r.rev), saleCount: Number(r.cnt ?? 0) })),
    topClients: topClientRows.map((r) => ({ clientId: Number(r.client_id ?? 0), name: String(r.name ?? "—"), revenue: money(r.rev), saleCount: Number(r.cnt ?? 0) })),
    topServices: itemRows.filter((r) => String(r.type) === "service").slice(0, 10).map((r) => ({ name: String(r.name ?? ""), revenue: money(r.rev), qty: Number(r.qty ?? 0) })),
    topProducts: itemRows.filter((r) => String(r.type) === "product").slice(0, 10).map((r) => ({ name: String(r.name ?? ""), revenue: money(r.rev), qty: Number(r.qty ?? 0) })),
    operators: opRows.map((r) => ({ name: String(r.op ?? "Non indicato"), revenue: money(r.rev), saleCount: Number(r.cnt ?? 0) })),
  };
}
