import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import {
  deleteAvailabilityEvent,
  deleteCabin,
  deleteClosureRange,
  deleteExceptionRange,
  deleteSharedResource,
  deleteStaffMember,
  resourceContext,
  saveAvailabilityEvent,
  saveBusinessHours,
  saveCabin,
  saveClosure,
  saveException,
  saveSharedResource,
  saveStaffMember,
} from "@/lib/manage-resources";
import { can, canAny, permissionForFeature } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  const activeUser = session.user;
  if (!canAny(activeUser.perms, ["resources.manage", "cabins.manage", "staff.manage", "staff_availability.manage", "hours.manage"])) {
    return jsonError("Permesso negato.", 403);
  }

  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "resources";
  if (!can(activeUser.perms, permissionForResourceSection(section))) return jsonError("Permesso negato.", 403);

  try {
    const context = await resourceContext({
      slug: tenantSlug,
      locationId: parseInteger(url.searchParams.get("location_id") ?? url.searchParams.get("locationId"), 0),
      date: url.searchParams.get("date") ?? undefined,
    });
    return Response.json({ ok: true, ...context });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Risorse non disponibili.", 400);
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  const activeUser = session.user;
  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "");

  try {
    if (action === "resource_save") {
      if (!can(activeUser.perms, "resources.manage")) return jsonError("Permesso Risorse richiesto.", 403);
      const resource = await saveSharedResource(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/resources.php", resource });
    }

    if (action === "resource_delete") {
      if (!can(activeUser.perms, "resources.manage")) return jsonError("Permesso Risorse richiesto.", 403);
      await deleteSharedResource(tenantSlug, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "app/pages/resources.php" });
    }

    if (action === "cabin_save") {
      if (!can(activeUser.perms, "cabins.manage")) return jsonError("Permesso Cabine richiesto.", 403);
      const cabin = await saveCabin(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/cabins.php", cabin });
    }

    if (action === "cabin_delete") {
      if (!can(activeUser.perms, "cabins.manage")) return jsonError("Permesso Cabine richiesto.", 403);
      await deleteCabin(tenantSlug, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "app/pages/cabins.php" });
    }

    if (action === "staff_save") {
      if (!can(activeUser.perms, "staff.manage")) return jsonError("Permesso Operatori richiesto.", 403);
      const staff = await saveStaffMember(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/staff.php", staff });
    }

    if (action === "staff_delete") {
      if (!can(activeUser.perms, "staff.manage")) return jsonError("Permesso Operatori richiesto.", 403);
      await deleteStaffMember(tenantSlug, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "app/pages/staff.php" });
    }

    if (action === "hours_save") {
      if (!can(activeUser.perms, "hours.manage")) return jsonError("Permesso Orari richiesto.", 403);
      const hours = await saveBusinessHours(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/hours.php?tab=hours", hours });
    }

    if (action === "closure_save") {
      if (!can(activeUser.perms, "hours.manage")) return jsonError("Permesso Orari richiesto.", 403);
      const closures = await saveClosure(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/hours.php?tab=closures", closures });
    }

    if (action === "closure_delete_range") {
      if (!can(activeUser.perms, "hours.manage")) return jsonError("Permesso Orari richiesto.", 403);
      const closures = await deleteClosureRange(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/hours.php?tab=closures", closures });
    }

    if (action === "exception_save") {
      if (!can(activeUser.perms, "hours.manage")) return jsonError("Permesso Orari richiesto.", 403);
      const exceptions = await saveException(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/hours.php?tab=exceptions", exceptions });
    }

    if (action === "exception_delete_range") {
      if (!can(activeUser.perms, "hours.manage")) return jsonError("Permesso Orari richiesto.", 403);
      const exceptions = await deleteExceptionRange(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/hours.php?tab=exceptions", exceptions });
    }

    if (action === "availability_save") {
      if (!can(activeUser.perms, "staff_availability.manage")) return jsonError("Permesso Disponibilita richiesto.", 403);
      const availability = await saveAvailabilityEvent(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/staff_availability.php", availability });
    }

    if (action === "availability_delete") {
      if (!can(activeUser.perms, "staff_availability.manage")) return jsonError("Permesso Disponibilita richiesto.", 403);
      const availability = await deleteAvailabilityEvent(tenantSlug, body);
      return Response.json({ ok: true, source: "app/pages/staff_availability.php", availability });
    }

    return jsonError("Azione risorse non valida.", 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore risorse.", 400);
  }
}

function permissionForResourceSection(section: string): string {
  if (section === "resources" || section === "hub") return "resources.manage";
  return permissionForFeature(section);
}
