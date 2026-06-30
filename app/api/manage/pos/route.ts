import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { cancelManageSale, checkoutManageSale, getManagePosContext, getManagePosResiduals } from "@/lib/manage-pos";
import { can, canAny } from "@/lib/role-permissions";
import type {
  PosCheckoutInput,
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
        source: "app/pages/pos.php?action=checkout",
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
        source: "app/pages/pos_history.php?action=cancel",
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
    items: saleItemsFromBody(body),
    payments: paymentsFromBody(body),
  };
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
  };
}

function normalizeItemType(value: string): PosSaleItemType | null {
  if (value === "service" || value === "product" || value === "prepaid" || value === "giftcard" || value === "package" || value === "giftbox") return value;
  return null;
}

function normalizePaymentMethod(value: string): PosPaymentMethod {
  if (value === "cash" || value === "card" || value === "transfer" || value === "giftcard" || value === "wallet") return value;
  if (value === "bank" || value === "bonifico" || value === "check" || value === "assegno") return "transfer";
  return "card";
}

function normalizeStockCancelMode(value: string | undefined): "restore" | "no_restore" | "none" {
  if (value === "no_restore") return "no_restore";
  if (value === "none") return "none";
  return "restore";
}
