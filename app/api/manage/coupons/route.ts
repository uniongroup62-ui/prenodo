import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { createDbCoupon, listDbCoupons, previewDbCoupon, redeemDbCoupon } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CouponType = "fixed" | "percent";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["coupons.manage", "pos.manage"])) return jsonError("Permesso buoni mancante.", 403);

  try {
    return Response.json({
      ok: true,
      source: "app/pages/coupons.php",
      sourceMode: "database",
      coupons: await listDbCoupons(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore coupon.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);

  const body = await parseRequestBody(request);
  const action = body.action ?? "preview";

  try {
    if (action === "create") {
      if (!can(session.user.perms, "coupons.manage")) return jsonError("Permesso buoni mancante.", 403);
      const input = {
        code: body.code,
        type: normalizeCouponType(body.type),
        value: parseNumber(body.value, 0),
        minSubtotal: parseNumber(body.min_subtotal, 0),
        startsAt: body.starts_at,
        endsAt: body.ends_at,
        usageLimit: parseInteger(body.usage_limit, 100),
      };
      const coupon = await createDbCoupon(input, tenantSlug);
      return Response.json({ ok: true, source: "coupons?action=create", sourceMode: "database", coupon, coupons: await listDbCoupons(tenantSlug) });
    }

    if (!canAny(session.user.perms, ["coupons.manage", "pos.manage"])) return jsonError("Permesso buoni mancante.", 403);

    if (action === "redeem") {
      const code = body.code ?? "";
      const subtotal = parseNumber(body.subtotal, 0);
      const result = await redeemDbCoupon(code, subtotal, tenantSlug);
      return Response.json({ ok: true, source: "coupons?action=redeem", sourceMode: "database", ...result, coupons: await listDbCoupons(tenantSlug) });
    }

    const code = body.code ?? "";
    const subtotal = parseNumber(body.subtotal, 0);
    const preview = await previewDbCoupon(code, subtotal, tenantSlug);
    return Response.json({ ok: true, source: "coupons?action=preview", sourceMode: "database", preview, coupons: await listDbCoupons(tenantSlug) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore coupon.");
  }
}

function normalizeCouponType(value: string | undefined): CouponType {
  return value === "percent" ? "percent" : "fixed";
}
