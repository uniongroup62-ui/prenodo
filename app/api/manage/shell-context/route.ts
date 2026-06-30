import { jsonError } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { getManageLocationContext } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import {
  getClosureRange,
  getNotificationSummary,
  getSupportAccess,
} from "@/lib/manage-shell-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Drives the global manage chrome (components/manage-shell.tsx): notification
// bell counts, the topbar location selector, and the support/closure sticky
// alerts. Faithful port of the View.php topbar context. Always tenant-scoped.
export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  const locationContext = await getManageLocationContext(tenantSlug);
  const currentLocationId = locationContext.currentLocationId;
  const needsLocationSelection = locationContext.needsLocationSelection;

  const [notif, closureRange, supportAccess] = await Promise.all([
    getNotificationSummary(tenantSlug, session.user, currentLocationId, needsLocationSelection),
    needsLocationSelection ? Promise.resolve(null) : getClosureRange(tenantSlug, currentLocationId),
    getSupportAccess(tenantSlug),
  ]);

  return Response.json({
    ok: true,
    sourceMode: locationContext.sourceMode,
    notif,
    locations: locationContext.locations.map((location) => ({ id: location.id, name: location.name })),
    currentLocationId,
    needsLocationSelection,
    supportAccess,
    closureRange,
  });
}
