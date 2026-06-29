import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import {
  deleteManageService,
  deleteServiceCategory,
  getManageServicesContext,
  moveServiceCategory,
  saveManageService,
  saveServiceCategory,
  saveServiceCategoryMarketplace,
  saveServiceOrder,
  saveServiceRecommendations,
} from "@/lib/manage-services";
import { can, canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);
  if (!canAny(session.user.perms, ["services.manage", "service_categories.manage", "service_recommendations.manage"])) {
    return jsonError("Permesso negato.", 403);
  }

  try {
    const url = new URL(request.url);
    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: url.searchParams.get("location_id"),
      fallbackCurrent: true,
    });
    return Response.json(await getManageServicesContext(tenantSlug, {
      query: url.searchParams.get("q") ?? "",
      locationId,
      includeInactive: ["1", "true", "yes", "all"].includes((url.searchParams.get("include_inactive") ?? "1").toLowerCase()),
    }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Servizi non caricati.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  try {
    const body = await parseRequestBody(request);
    const url = new URL(request.url);
    const action = String(body.action ?? url.searchParams.get("action") ?? "create");

    switch (action) {
      case "create":
      case "new":
      case "service_save":
      case "update":
      case "edit":
        if (!can(session.user.perms, "services.manage")) return jsonError("Permesso Servizi richiesto.", 403);
        return Response.json(await saveManageService(tenantSlug, body));

      case "delete":
      case "service_delete":
        if (!can(session.user.perms, "services.manage")) return jsonError("Permesso Servizi richiesto.", 403);
        return Response.json(await deleteManageService(tenantSlug, parseInteger(body.id ?? body.service_id, 0)));

      case "category_save":
      case "service_category_save":
      case "category_new":
      case "category_edit":
        if (!can(session.user.perms, "service_categories.manage")) return jsonError("Permesso Categorie servizi richiesto.", 403);
        return Response.json(await saveServiceCategory(tenantSlug, body));

      case "category_delete":
      case "service_category_delete":
        if (!can(session.user.perms, "service_categories.manage")) return jsonError("Permesso Categorie servizi richiesto.", 403);
        return Response.json(await deleteServiceCategory(tenantSlug, parseInteger(body.id ?? body.category_id, 0)));

      case "category_move":
      case "service_category_move":
        if (!can(session.user.perms, "service_categories.manage")) return jsonError("Permesso Categorie servizi richiesto.", 403);
        return Response.json(await moveServiceCategory(
          tenantSlug,
          parseInteger(body.id ?? body.category_id, 0),
          body.direction === "down" ? "down" : "up",
        ));

      case "save_service_order":
      case "service_order_save":
        if (!can(session.user.perms, "service_categories.manage")) return jsonError("Permesso Categorie servizi richiesto.", 403);
        return Response.json(await saveServiceOrder(tenantSlug, body));

      case "category_marketplace_save":
      case "service_category_marketplace_save":
        if (!canAny(session.user.perms, ["service_categories.manage", "settings.general"])) return jsonError("Permesso Marketplace richiesto.", 403);
        return Response.json(await saveServiceCategoryMarketplace(tenantSlug, body));

      case "recommendations_save":
      case "service_recommendations_save":
      case "recommended_save":
        if (!can(session.user.perms, "service_recommendations.manage")) return jsonError("Permesso Servizi consigliati richiesto.", 403);
        return Response.json(await saveServiceRecommendations(tenantSlug, body));

      default:
        return jsonError("Azione servizi non supportata.", 400);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Operazione servizi non riuscita.");
  }
}
