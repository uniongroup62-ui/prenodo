import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { cancelManageSale, checkoutManageSale, getManagePosAppointmentCart, getManagePosContext, getManagePosResiduals, getManageSaleDetail, markManageSaleItemCollected } from "@/lib/manage-pos";
import { can, canAny } from "@/lib/role-permissions";
import type {
  PosCheckoutInput,
  PosInstallmentPlanInput,
  PosPaymentInput,
  PosPaymentMethod,
  PosSaleItemInput,
  PosSaleItemType,
} from "@/lib/tenant-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["pos.manage", "pos.movements"])) return jsonError("Permesso POS mancante.", 403);

  const url = new URL(request.url);

  // Residui lookup for the "Residui" panel: the selected client's wallet CREDIT
  // balance + available GiftCards. Faithful to pos.php?action=pos_residual_credit_data.
  if (url.searchParams.get("action") === "client_residuals") {
    const clientId = parseInteger(url.searchParams.get("client_id"), 0);
    try {
      return Response.json(await getManagePosResiduals(tenantSlug, clientId));
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore residui POS.");
    }
  }

  // "Vendita da appuntamento" pre-load: the cart seed (client + service lines with the
  // current catalog price) for cashing out a completed appointment in the POS. The UI seeds
  // the cart from this, then a normal checkout (with appointment_id) records the sale AND
  // marks the appointment 'done'. Same tenant + POS permission gate as the rest of the route.
  if (url.searchParams.get("action") === "appointment_cart") {
    const appointmentId = parseInteger(url.searchParams.get("appointment_id"), 0);
    try {
      return Response.json(await getManagePosAppointmentCart(tenantSlug, appointmentId));
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore caricamento appuntamento POS.");
    }
  }

  // POS "Dettaglio vendita" (pos_sale_detail.php): the full single sale (header + items +
  // payments + totals) plus the cancel summary + blockers. Read-gated by the POS permission
  // already checked above; the cancel/pickup ACTIONS below carry the stronger movements gate.
  if (url.searchParams.get("action") === "sale_detail") {
    const saleId = parseInteger(url.searchParams.get("id") ?? url.searchParams.get("sale_id"), 0);
    if (saleId <= 0) return jsonError("ID vendita mancante.");
    try {
      return Response.json(await getManageSaleDetail(tenantSlug, saleId));
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore dettaglio vendita.");
    }
  }

  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: url.searchParams.get("location_id"),
    fallbackCurrent: true,
  });
  const includeCancelled = ["1", "true", "yes"].includes((url.searchParams.get("include_cancelled") ?? "1").toLowerCase());

  try {
    return Response.json(await getManagePosContext(tenantSlug, {
      locationId,
      includeCancelled,
      query: url.searchParams.get("q") ?? "",
    }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore POS.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);

  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "checkout");

  try {
    if (action === "checkout") {
      if (!can(session.user.perms, "pos.manage")) return jsonError("Permesso cassa mancante.", 403);
      const input = await checkoutInputFromBody(body, tenantSlug);
      const payload = await checkoutManageSale(tenantSlug, input, {
        id: session.user.id,
        name: session.user.name,
      });
      return Response.json({
        ...payload,
      });
    }

    if (action === "cancel") {
      if (!can(session.user.perms, "pos.movements")) return jsonError("Permesso movimenti POS mancante.", 403);
      const saleId = parseInteger(body.id ?? body.sale_id);
      if (saleId <= 0) return jsonError("ID vendita mancante.");

      const payload = await cancelManageSale(tenantSlug, {
        saleId,
        reason: body.reason ?? body.cancel_reason ?? "",
        stockCancelMode: normalizeStockCancelMode(body.stock_cancel_mode),
        userId: session.user.id,
        userName: session.user.name,
      });
      return Response.json({
        ...payload,
      });
    }

    // PICKUP ("Segna ritirato"): mark a product sale line as collected. Faithful (minimal)
    // port of pos_sale_detail.php?do=mark_preorder_collection — gated by pos.preorders OR
    // pos.manage (the legacy Auth::canAny(['pos.manage','pos.preorders'])).
    if (action === "mark_collected") {
      if (!canAny(session.user.perms, ["pos.manage", "pos.preorders"])) return jsonError("Non hai i permessi per gestire i preordini.", 403);
      const saleId = parseInteger(body.sale_id ?? body.id);
      const saleItemId = parseInteger(body.sale_item_id);
      if (saleId <= 0 || saleItemId <= 0) return jsonError("Riga prodotto non valida.");
      const payload = await markManageSaleItemCollected(tenantSlug, {
        saleId,
        saleItemId,
        userId: session.user.id,
        userName: session.user.name,
      });
      return Response.json({
        ...payload,
      });
    }

    return jsonError("Azione POS non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore POS.");
  }
}

async function checkoutInputFromBody(body: Record<string, string>, tenantSlug: string): Promise<PosCheckoutInput> {
  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: body.location_id === undefined ? null : body.location_id,
    fallbackCurrent: true,
  });

  return {
    clientId: parseInteger(body.client_id, 0),
    clientName: body.client_name,
    appointmentId: parseInteger(body.appointment_id, 0),
    locationId,
    discount: parseNumber(body.discount, 0),
    couponCode: body.coupon_code,
    notes: body.notes,
    promotionId: parseInteger(body.promotion_id, 0),
    installments: parseInteger(body.installments, 0),
    // FIDELITY points the staff applies as a discount (legacy POST field fidelity_points_use).
    fidelityPointsUse: parseNumber(body.fidelity_points_use, 0),
    // RATEIZZAZIONE: the optional installment plan params (faithful to the legacy
    // installment_plan_json POST field). Present only when the staff chose "Rateizzato".
    installmentPlan: installmentPlanFromBody(body),
    items: saleItemsFromBody(body),
    payments: paymentsFromBody(body),
  };
}

// Parse the optional installment plan params from the checkout body. The UI sends an
// installment_plan JSON blob ({count, down_payment, interval_value, interval_unit,
// first_due_date, note}) when "Rateizzato" is active. Returns undefined for a single payment
// (the common path) or any malformed / count < 2 plan, so the backend skips plan creation.
function installmentPlanFromBody(body: Record<string, string>): PosInstallmentPlanInput | undefined {
  const raw = body.installment_plan ?? body.installment_plan_json;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const count = parseInteger(parsed.count ?? parsed.installments_count, 0);
    if (count < 2) return undefined;
    const unit = String(parsed.intervalUnit ?? parsed.interval_unit ?? "month").toLowerCase();
    return {
      count,
      downPayment: parseNumber(parsed.downPayment ?? parsed.down_payment ?? parsed.down_payment_amount, 0),
      intervalValue: parseInteger(parsed.intervalValue ?? parsed.interval_value, 1),
      intervalUnit: unit === "day" || unit === "week" ? unit : "month",
      firstDueDate: String(parsed.firstDueDate ?? parsed.first_due_date ?? "").trim() || undefined,
      note: String(parsed.note ?? parsed.notes ?? "").trim() || undefined,
    };
  } catch {
    return undefined;
  }
}

function saleItemsFromBody(body: Record<string, string>): PosSaleItemInput[] {
  const rawJson = body.items_json ?? body.items;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Array<Record<string, unknown>>;
      const items = parsed.map((item) => normalizeSaleItemInput(item)).filter(Boolean) as PosSaleItemInput[];
      if (items.length > 0) return items;
    } catch {
      // Fallback ai campi semplici, come faceva la pagina PHP con POST tradizionale.
    }
  }

  const items: PosSaleItemInput[] = [];
  const serviceId = parseInteger(body.service_id, 0);
  const productId = parseInteger(body.product_id, 0);

  if (serviceId > 0 || body.service_name) {
    items.push({
      type: "service",
      refId: serviceId,
      name: body.service_name,
      quantity: parseNumber(body.service_qty, 1),
      unitPrice: body.service_price ? parseNumber(body.service_price, 0) : undefined,
      status: "executed",
    });
  }

  if (productId > 0 || body.product_name) {
    items.push({
      type: "product",
      refId: productId,
      name: body.product_name,
      quantity: parseNumber(body.product_qty, 1),
      unitPrice: body.product_price ? parseNumber(body.product_price, 0) : undefined,
      status: "collected",
    });
  }

  return items;
}

function paymentsFromBody(body: Record<string, string>): PosPaymentInput[] {
  const rawJson = body.payments_json ?? body.payments;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Array<Record<string, unknown>>;
      const payments = parsed
        .map((payment) => ({
          method: normalizePaymentMethod(String(payment.method ?? "")),
          amount: parseNumber(payment.amount, 0),
          giftcardId: parseInteger(payment.giftcardId ?? payment.giftcard_id, 0),
        }))
        .filter((payment) => payment.amount > 0);
      if (payments.length > 0) return payments;
    } catch {
      // Fallback ai campi semplici sotto.
    }
  }

  return [
    {
      method: normalizePaymentMethod(body.payment_method ?? "card"),
      amount: parseNumber(body.payment_amount, 0),
    },
  ];
}

function normalizeSaleItemInput(item: Record<string, unknown>): PosSaleItemInput | null {
  const type = normalizeItemType(String(item.type ?? ""));
  if (!type) return null;

  return {
    type,
    refId: parseInteger(item.refId ?? item.ref_id, 0),
    name: item.name ? String(item.name) : undefined,
    quantity: parseNumber(item.quantity ?? item.qty, 1),
    unitPrice: item.unitPrice === undefined ? parseNumber(item.unit_price, 0) : parseNumber(item.unitPrice, 0),
    status: item.status ? String(item.status) as PosSaleItemInput["status"] : undefined,
    // Package sale meta (faithful to the legacy items[idx][package_*] fields): the custom
    // validity window + note, read only for a type:"package" line at issue time.
    startDate: packageMetaString(item.startDate ?? item.start_date ?? item.package_start_date),
    expiresAt: packageMetaString(item.expiresAt ?? item.expires_at ?? item.package_expires_at),
    note: packageMetaString(item.note ?? item.package_note),
    // GiftCard / GiftBox sale meta (faithful to the legacy issue_giftcard / issue_giftbox
    // POST fields): the chosen recipient (client/free-text), optional custom code, expiry,
    // dedica + hide-amount toggle + event type. Read for a type:"giftcard" line (issuing the
    // giftcards row) and a type:"giftbox" line (issuing the giftbox_instances row, where
    // refId is the chosen giftboxes TEMPLATE id and recipientClientId is the instance OWNER).
    recipientClientId: parseInteger(item.recipientClientId ?? item.recipient_client_id, 0) || undefined,
    recipientName: packageMetaString(item.recipientName ?? item.recipient_name),
    recipientEmail: packageMetaString(item.recipientEmail ?? item.recipient_email),
    code: packageMetaString(item.code ?? item.giftcard_code),
    eventType: packageMetaString(item.eventType ?? item.event_type),
    message: packageMetaString(item.message ?? item.gift_message),
    hideAmount: parseBoolean(item.hideAmount ?? item.hide_amount),
    // RECHARGE sale meta (faithful to the legacy recharge POST fields): the base/bonus/total
    // top-up + the earn-points-on-bonus toggle, read only for a type:"recharge" line. The
    // wallet credit + recharges row are written from these at checkout (issueRechargeFromSale).
    baseAmount: item.baseAmount === undefined && item.base_amount === undefined ? undefined : parseNumber(item.baseAmount ?? item.base_amount, 0),
    bonusKind: packageMetaString(item.bonusKind ?? item.bonus_kind),
    bonusValue: item.bonusValue === undefined && item.bonus_value === undefined ? undefined : parseNumber(item.bonusValue ?? item.bonus_value, 0),
    bonusAmount: item.bonusAmount === undefined && item.bonus_amount === undefined ? undefined : parseNumber(item.bonusAmount ?? item.bonus_amount, 0),
    totalAmount: item.totalAmount === undefined && item.total_amount === undefined ? undefined : parseNumber(item.totalAmount ?? item.total_amount, 0),
    earnPoints: parseBoolean(item.earnPoints ?? item.earn_points),
  };
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "si"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return undefined;
}

function packageMetaString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function normalizeItemType(value: string): PosSaleItemType | null {
  if (value === "service" || value === "product" || value === "prepaid" || value === "giftcard" || value === "package" || value === "giftbox" || value === "recharge") return value;
  return null;
}

function normalizePaymentMethod(value: string): PosPaymentMethod {
  if (value === "cash" || value === "card" || value === "check" || value === "transfer" || value === "giftcard" || value === "wallet") return value;
  if (value === "assegno") return "check"; // preserve Assegno (was folded to transfer)
  if (value === "bank" || value === "bonifico") return "transfer";
  return "card";
}

function normalizeStockCancelMode(value: string | undefined): "restore" | "no_restore" | "none" {
  if (value === "no_restore") return "no_restore";
  if (value === "none") return "none";
  return "restore";
}
