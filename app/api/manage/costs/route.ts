import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import {
  deleteCost,
  deleteCostCategory,
  getManageCost,
  getManageCostsContext,
  saveCost,
  saveCostCategory,
  toggleCostCategory,
  toggleCostPaid,
} from "@/lib/manage-costs";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const workPerms = ["costs.manage", "costs.items"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);
  if (!canAny(session.user.perms, [...workPerms, "costs.categories"])) return jsonError("Permesso negato.", 403);

  try {
    const url = new URL(request.url);

    // Edit-form prefill: return ONE cost's editable fields for one id. Port of
    // costs.php action=edit. Gated by the same Scadenziario work permission as
    // the save action.
    if (url.searchParams.get("action") === "get") {
      if (!canAny(session.user.perms, workPerms)) return jsonError("Permesso Scadenziario richiesto.", 403);
      const costId = parseInteger(url.searchParams.get("id"), 0);
      if (costId <= 0) return jsonError("ID costo mancante.");
      const cost = await getManageCost(tenantSlug, costId);
      if (!cost) return jsonError("Costo non trovato.", 404);
      return Response.json({ ok: true, source: "costs?action=get", sourceMode: "database", cost });
    }

    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: url.searchParams.get("location_id"),
      fallbackCurrent: true,
    });
    return Response.json(await getManageCostsContext(tenantSlug, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      query: url.searchParams.get("q") ?? "",
      categoryId: parseInteger(url.searchParams.get("category_id") ?? url.searchParams.get("cat"), 0),
      locationId,
    }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Scadenziario non caricato.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  try {
    const body = await parseRequestBody(request);
    const url = new URL(request.url);
    const action = String(body.action ?? url.searchParams.get("action") ?? "save_cost");
    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: body.location_id === undefined ? url.searchParams.get("location_id") : body.location_id,
      fallbackCurrent: true,
    });

    switch (action) {
      case "create":
      case "save":
      case "save_cost":
      case "cost_save":
        if (!canAny(session.user.perms, workPerms)) return jsonError("Permesso Scadenziario richiesto.", 403);
        return Response.json(await saveCost(tenantSlug, { ...body, location_id: body.location_id || String(locationId) }));

      case "delete":
      case "cost_delete":
        if (!canAny(session.user.perms, workPerms)) return jsonError("Permesso Scadenziario richiesto.", 403);
        return Response.json(await deleteCost(tenantSlug, parseInteger(body.id ?? body.cost_id, 0), locationId));

      case "pay":
      case "toggle_paid":
      case "cost_toggle_paid":
        if (!canAny(session.user.perms, workPerms)) return jsonError("Permesso Scadenziario richiesto.", 403);
        return Response.json(await toggleCostPaid(tenantSlug, parseInteger(body.id ?? body.cost_id, 0), locationId));

      case "save_category":
      case "category_save":
      case "cost_category_save":
        if (!can(session.user.perms, "costs.categories")) return jsonError("Permesso Categorie costi richiesto.", 403);
        return Response.json(await saveCostCategory(tenantSlug, body));

      case "delete_category":
      case "category_delete":
      case "cost_category_delete":
        if (!can(session.user.perms, "costs.categories")) return jsonError("Permesso Categorie costi richiesto.", 403);
        return Response.json(await deleteCostCategory(tenantSlug, parseInteger(body.id ?? body.category_id, 0)));

      case "toggle_category":
      case "category_toggle":
        if (!can(session.user.perms, "costs.categories")) return jsonError("Permesso Categorie costi richiesto.", 403);
        return Response.json(await toggleCostCategory(tenantSlug, parseInteger(body.id ?? body.category_id, 0)));

      default:
        return jsonError("Azione costi non supportata.", 400);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Operazione costi non riuscita.");
  }
}
