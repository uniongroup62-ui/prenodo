import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { listDbPromotions, previewDbPromotion, toggleDbPromotion } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["promotions.manage", "pos.manage"])) return jsonError("Permesso promozioni mancante.", 403);

  try {
    return Response.json({
      ok: true,
      source: "app/pages/promotions.php",
      sourceMode: "database",
      promotions: await listDbPromotions(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore promozioni.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);

  const body = await parseRequestBody(request);
  const action = body.action ?? "preview";
  const id = parseInteger(body.id);

  try {
    if (action === "toggle") {
      if (!can(session.user.perms, "promotions.manage")) return jsonError("Permesso promozioni mancante.", 403);
      const active = ["1", "true", "yes", "on"].includes((body.active ?? "").toLowerCase());
      const promotion = await toggleDbPromotion(id, active, tenantSlug);
      return Response.json({ ok: true, source: "promotions?action=toggle", sourceMode: "database", promotion, promotions: await listDbPromotions(tenantSlug) });
    }

    if (!canAny(session.user.perms, ["promotions.manage", "pos.manage"])) return jsonError("Permesso promozioni mancante.", 403);
    const subtotal = parseNumber(body.subtotal, 0);
    const preview = await previewDbPromotion(id, subtotal, tenantSlug);
    return Response.json({ ok: true, source: "promotions?action=preview", sourceMode: "database", preview, promotions: await listDbPromotions(tenantSlug) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore promozioni.");
  }
}
