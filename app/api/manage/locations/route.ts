import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession, setManageSessionCookie } from "@/lib/manage-auth";
import { filterLocationsForManageSession, getManageLocationContext } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const locationContext = await getManageLocationContext(tenantSlug);

  return Response.json({
    ok: true,
    source: "app/lib/Auth.php + app/lib/View.php location gate",
    sourceMode: locationContext.sourceMode,
    locations: locationContext.locations,
    currentLocationId: locationContext.currentLocationId,
    needsLocationSelection: locationContext.needsLocationSelection,
  });
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  const body = await parseRequestBody(request);
  const locationId = parseInteger(body.location_id, 0);
  const locationContext = await getManageLocationContext(tenantSlug);
  const sourceMode = locationContext.sourceMode;
  const locations = filterLocationsForManageSession(locationContext.allLocations, session.user.locationIds, session.user.role);
  const selected = locations.find((location) => location.id === locationId);
  if (!selected) return jsonError("Sede non disponibile per questo utente.", 403);

  const nextSession = {
    ...session,
    user: {
      ...session.user,
      currentLocationId: selected.id,
      needsLocationSelection: false,
    },
    issuedAt: Date.now(),
  };
  await setManageSessionCookie(nextSession);

  return Response.json({
    ok: true,
    source: "location?action=select",
    sourceMode,
    location: selected,
    locations,
    currentLocationId: selected.id,
    needsLocationSelection: false,
  });
}
