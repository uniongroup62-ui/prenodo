import "server-only";

import { listDbLocations } from "@/lib/db-repositories";
import { currentManageSession, type ManageSession } from "@/lib/manage-auth";

type SourceMode = "database";
type Location = {
  id: number;
  tenantSlug: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  area: string;
  phone: string;
  hoursToday: string;
  bookingEnabled: boolean;
  marketplaceEnabled: boolean;
};

export type ManageLocationContext = {
  session: ManageSession | null;
  sourceMode: SourceMode;
  locations: Location[];
  allLocations: Location[];
  currentLocationId: number;
  needsLocationSelection: boolean;
};

export async function getManageLocationContext(
  slug: string,
  options: { bookingOnly?: boolean } = {},
): Promise<ManageLocationContext> {
  const session = await currentManageSession(slug);
  const activeUser = session?.user;
  const allLocationRows = await listDbLocations(slug);
  const allLocations = options.bookingOnly
    ? allLocationRows.filter((location) => location.bookingEnabled)
    : allLocationRows;
  const locations = filterLocationsForManageSession(allLocations, activeUser?.locationIds ?? [], activeUser?.role);
  const currentLocationId = resolveCurrentManageLocationId(session?.user.currentLocationId ?? 0, locations);

  return {
    session,
    sourceMode: "database",
    allLocations,
    locations,
    currentLocationId,
    needsLocationSelection: locations.length > 1 && currentLocationId <= 0,
  };
}

export async function resolveManageLocationId({
  slug,
  raw,
  fallbackCurrent = true,
  bookingOnly = false,
}: {
  slug: string;
  raw?: string | number | null;
  fallbackCurrent?: boolean;
  bookingOnly?: boolean;
}): Promise<number> {
  const context = await getManageLocationContext(slug, { bookingOnly });
  const hasRaw = raw !== null && raw !== undefined && String(raw).trim() !== "";
  const rawId = Number.parseInt(String(raw ?? "0"), 10);

  if (rawId > 0) {
    return context.locations.some((location) => location.id === rawId) ? rawId : 0;
  }

  if (hasRaw) return 0;
  if (fallbackCurrent && context.currentLocationId > 0) return context.currentLocationId;
  return context.locations.length === 1 ? context.locations[0]?.id ?? 0 : 0;
}

export function filterLocationsForManageSession<T extends { id: number }>(
  locations: T[],
  locationIds: number[],
  role?: string,
): T[] {
  if ((role ?? "").toLowerCase() === "admin" || locationIds.length === 0) return locations;
  const allowed = new Set(locationIds);
  return locations.filter((location) => allowed.has(location.id));
}

export function resolveCurrentManageLocationId<T extends { id: number }>(
  currentLocationId: number,
  locations: T[],
): number {
  if (locations.some((location) => location.id === currentLocationId)) return currentLocationId;
  return locations.length === 1 ? locations[0]?.id ?? 0 : 0;
}
