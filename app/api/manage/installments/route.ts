import type { RowDataPacket } from "@/lib/tenant-db";
import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { createDbInstallmentPlan, listDbInstallmentPlans } from "@/lib/db-repositories";
import { can } from "@/lib/role-permissions";
import { tenantSelect, tenantUpdate } from "@/lib/tenant-db";
import type { InstallmentPlan } from "@/lib/tenant-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "installments.manage")) return jsonError("Permesso rate mancante.", 403);

  try {
    return Response.json({
      ok: true,
      sourceMode: "database",
      plans: await listDbInstallmentPlans(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore rate.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "installments.manage")) return jsonError("Permesso rate mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? body.do ?? "create";

  try {
    if (action === "create") {
      const plan = await createDbInstallmentPlan({
        saleId: parseInteger(body.sale_id, 0),
        clientId: parseInteger(body.client_id, 0),
        clientName: body.client_name,
        total: parseNumber(body.total, 0),
        count: parseInteger(body.count, 3),
      }, tenantSlug);
      return Response.json({ ok: true, source: "installments?action=create", sourceMode: "database", plan, plans: await listDbInstallmentPlans(tenantSlug) });
    }

    if (action === "pay" || action === "mark_paid") {
      const plan = await markInstallmentPaid(tenantSlug, {
        installmentId: parseInteger(body.installment_id ?? body.id),
        paidAmount: body.paid_amount,
        paidAt: body.paid_at,
        paymentType: body.payment_type,
        note: body.note,
        userId: session.user.id,
      });
      return Response.json({ ok: true, source: "installments?action=pay", sourceMode: "database", plan, plans: await listDbInstallmentPlans(tenantSlug) });
    }

    if (action === "pending" || action === "reopen" || action === "mark_pending") {
      const plan = await markInstallmentPending(tenantSlug, parseInteger(body.installment_id ?? body.id), session.user.id);
      return Response.json({ ok: true, source: "installments?action=mark_pending", sourceMode: "database", plan, plans: await listDbInstallmentPlans(tenantSlug) });
    }

    return jsonError("Azione rate non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore rate.");
  }
}

async function markInstallmentPaid(
  slug: string,
  options: { installmentId: number; paidAmount?: string; paidAt?: string; paymentType?: string; note?: string; userId: number },
): Promise<InstallmentPlan> {
  const row = await installmentRow(slug, options.installmentId);
  if (String(row.status ?? "") === "paid") throw new Error("Rata gia pagata.");
  if (String(row.status ?? "") === "cancelled") throw new Error("Rata annullata.");

  const amount = Number(row.amount ?? 0) || 0;
  const paidAmount = String(options.paidAmount ?? "").trim() ? parseNumber(options.paidAmount, amount) : amount;
  await tenantUpdate({
    slug,
    table: "sale_installments",
    id: options.installmentId,
    values: {
      status: "paid",
      paid_at: parsePaidAt(options.paidAt),
      paid_amount: paidAmount,
      payment_type: clean(options.paymentType, 20) || undefined,
      note: clean(options.note, 1000) || undefined,
      updated_by: options.userId,
    },
  });

  const planId = Number(row.plan_id ?? 0);
  await refreshInstallmentPlanStatus(slug, planId);
  return installmentPlan(slug, planId);
}

async function markInstallmentPending(slug: string, installmentId: number, userId: number): Promise<InstallmentPlan> {
  const row = await installmentRow(slug, installmentId);
  if (String(row.status ?? "") === "cancelled") throw new Error("Rata annullata.");
  await tenantUpdate({
    slug,
    table: "sale_installments",
    id: installmentId,
    values: {
      status: "pending",
      paid_at: null,
      paid_amount: null,
      updated_by: userId,
    },
  });

  const planId = Number(row.plan_id ?? 0);
  await tenantUpdate({ slug, table: "sale_installment_plans", id: planId, values: { status: "active", updated_by: userId } });
  return installmentPlan(slug, planId);
}

async function installmentRow(slug: string, installmentId: number): Promise<RowDataPacket> {
  if (installmentId <= 0) throw new Error("Rata non valida.");
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_installments",
    where: "id = ?",
    params: [installmentId],
    limit: 1,
  });
  if (!rows[0]) throw new Error("Rata non trovata.");
  return rows[0];
}

async function refreshInstallmentPlanStatus(slug: string, planId: number): Promise<void> {
  if (planId <= 0) return;
  const open = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_installments",
    columns: "id",
    where: "plan_id = ? AND status NOT IN ('paid','cancelled','canceled')",
    params: [planId],
    limit: 1,
  });
  await tenantUpdate({
    slug,
    table: "sale_installment_plans",
    id: planId,
    values: { status: open[0] ? "active" : "completed" },
  });
}

async function installmentPlan(slug: string, planId: number): Promise<InstallmentPlan> {
  const plan = (await listDbInstallmentPlans(slug)).find((item) => item.id === planId);
  if (!plan) throw new Error("Piano rateale non trovato.");
  return plan;
}

function parsePaidAt(value: string | undefined): Date | string {
  const raw = clean(value, 40);
  if (!raw) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00:00`;
  return raw;
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
