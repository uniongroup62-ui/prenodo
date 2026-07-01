import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { cancelManageCoupon, createDbCoupon, deleteManageCoupon, getManageCoupon, listDbCoupons, listManageCoupons, previewDbCoupon, redeemDbCoupon, saveManageCoupon } from "@/lib/db-repositories";
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
    const url = new URL(request.url);

    // Edit-form prefill: return ONE coupon's editable fields for one id. Port of
    // coupons.php action=edit. Gated by coupons.manage like the save action.
    if (url.searchParams.get("action") === "get") {
      if (!can(session.user.perms, "coupons.manage")) return jsonError("Permesso buoni mancante.", 403);
      const couponId = parseInteger(url.searchParams.get("id"), 0);
      if (couponId <= 0) return jsonError("ID coupon mancante.");
      const coupon = await getManageCoupon(tenantSlug, couponId);
      if (!coupon) return jsonError("Coupon non trovato.", 404);
      return Response.json({ ok: true, source: "coupons?action=get", sourceMode: "database", coupon });
    }

    return Response.json({
      ok: true,
      sourceMode: "database",
      coupons: await listManageCoupons(tenantSlug),
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
      return Response.json({ ok: true, source: "coupons?action=create", sourceMode: "database", coupon, coupons: await listManageCoupons(tenantSlug) });
    }

    // Faithful coupon editor save (port of coupons.php POST action=new|edit). id=0
    // creates, id>0 updates; the code is immutable on edit.
    if (action === "save" || action === "new" || action === "edit" || action === "update") {
      if (!can(session.user.perms, "coupons.manage")) return jsonError("Permesso buoni mancante.", 403);
      const coupon = await saveManageCoupon(tenantSlug, body, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "coupons?action=save", sourceMode: "database", coupon, coupons: await listManageCoupons(tenantSlug) });
    }

    // Delete a coupon (port of coupons.php action=delete). Refuses while open
    // appointments reference it; soft-deletes when used (history preserved),
    // hard-deletes when unused.
    if (action === "delete") {
      if (!can(session.user.perms, "coupons.manage")) return jsonError("Permesso buoni mancante.", 403);
      const result = await deleteManageCoupon(tenantSlug, parseInteger(body.id, 0), session.user.id);
      return Response.json({ ok: true, source: "coupons?action=delete", sourceMode: "database", mode: result.mode, message: result.message, coupons: await listManageCoupons(tenantSlug) });
    }

    // Disable a coupon (port of coupons.php action=cancel): is_active=0 + audit.
    if (action === "cancel" || action === "disable") {
      if (!can(session.user.perms, "coupons.manage")) return jsonError("Permesso buoni mancante.", 403);
      await cancelManageCoupon(tenantSlug, parseInteger(body.id, 0), String(body.cancel_reason ?? body.reason ?? ""), session.user.id);
      return Response.json({ ok: true, source: "coupons?action=cancel", sourceMode: "database", coupons: await listManageCoupons(tenantSlug) });
    }

    // preview/redeem are also reachable from the quick-booking drawer's coupon Apply
    // (port of api_appointments action=coupon_preview), so a booking-capable user must be
    // able to validate a coupon even without the coupons/pos management permission.
    if (!canAny(session.user.perms, ["coupons.manage", "pos.manage", "appointments.manage", "appointments.plan", "appointments.quick_booking"])) {
      return jsonError("Permesso buoni mancante.", 403);
    }

    if (action === "redeem") {
      const code = body.code ?? "";
      const subtotal = parseNumber(body.subtotal, 0);
      const result = await redeemDbCoupon(code, subtotal, tenantSlug);
      return Response.json({ ok: true, source: "coupons?action=redeem", sourceMode: "database", ...result, coupons: await listDbCoupons(tenantSlug) });
    }

    const code = body.code ?? "";
    const subtotal = parseNumber(body.subtotal, 0);
    // Booking context forwarded by the quick-booking drawer (port of the legacy
    // action=coupon_preview inputs): service ids, location, appointment date/time, client id
    // and the editing appointment id. All optional + backward-compatible — the POS preview
    // (which posts only { code, subtotal }) is unchanged. Currently only appt_date changes the
    // outcome (active-window validated as of the booked day); see previewDbCoupon.
    const serviceIds = String(body.service_ids ?? "")
      .split(",")
      .map((v) => parseInteger(v, 0))
      .filter((n) => n > 0);
    const preview = await previewDbCoupon(code, subtotal, tenantSlug, {
      serviceIds,
      locationId: parseInteger(body.location_id, 0) || null,
      clientId: parseInteger(body.client_id, 0) || null,
      appointmentId: parseInteger(body.appointment_id, 0) || null,
      apptDate: typeof body.appt_date === "string" ? body.appt_date : null,
      apptTime: typeof body.appt_time === "string" ? body.appt_time : null,
    });
    return Response.json({ ok: true, source: "coupons?action=preview", sourceMode: "database", preview, coupons: await listDbCoupons(tenantSlug) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore coupon.");
  }
}

function normalizeCouponType(value: string | undefined): CouponType {
  return value === "percent" ? "percent" : "fixed";
}
