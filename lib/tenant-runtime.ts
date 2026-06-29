import { locations, type Location } from "@/lib/demo-data";
import { allAssignablePermissions } from "@/lib/role-permissions";

export type DemoUserRole = "admin" | "staff" | "altro";

export type DemoUser = {
  id: number;
  name: string;
  email: string;
  role: DemoUserRole;
  perms: string[];
  locationIds?: number[];
};

export const tenantSlug = "centroesteticoelite";

export const demoAdminUser: DemoUser = {
  id: 1,
  name: "Centro Estetico Elite",
  email: "info@artebrand.it",
  role: "admin",
  perms: allAssignablePermissions(),
};

export const demoStaffUser: DemoUser = {
  id: 2,
  name: "Marta",
  email: "marta@centroesteticoelite.test",
  role: "staff",
  perms: [
    "dashboard.view",
    "calendar.view",
    "appointments.manage",
    "appointments.plan",
    "appointments.quick_booking",
    "clients.manage",
    "services.manage",
  ],
  locationIds: [1],
};

export function normalizeTenantSlug(slug: string | null | undefined): string | null {
  const normalized = (slug ?? "").trim().toLowerCase();
  return normalized || null;
}

export function tenantPrefix(slug: string | null | undefined): string {
  const normalized = normalizeTenantSlug(slug);
  return normalized ? `${normalized}__` : "";
}

export function tenantSessionSuffix(slug: string | null | undefined, isSaasAdmin = false): string {
  if (isSaasAdmin) return "saas";

  const normalized = normalizeTenantSlug(slug);
  if (!normalized) return "root";

  return `t_${normalized.replace(/[^a-z0-9_-]/g, "_")}`;
}

export function tenantUrl(slug: string | null | undefined, path = "", origin = "http://localhost:3000"): string {
  const normalized = normalizeTenantSlug(slug);
  const cleanedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${origin.replace(/\/$/, "")}${normalized ? `/${encodeURIComponent(normalized)}` : ""}${cleanedPath}`;
}

export function tenantLocations(slug: string, bookingOnly = false): Location[] {
  const normalized = normalizeTenantSlug(slug);
  if (!normalized) return [];

  return locations.filter((location) => {
    if (location.tenantSlug !== normalized) return false;
    if (bookingOnly && !location.bookingEnabled) return false;
    return true;
  });
}

export function userIsAdminLike(user: DemoUser | null | undefined): boolean {
  return (user?.role ?? "").toLowerCase() === "admin";
}

export function userLocationOptions({
  slug,
  user = demoAdminUser,
  bookingOnly = false,
}: {
  slug: string;
  user?: DemoUser | null;
  bookingOnly?: boolean;
}): Location[] {
  const all = tenantLocations(slug, bookingOnly);
  if (!user || all.length <= 1 || userIsAdminLike(user)) return all;

  const allowed = new Set(user.locationIds ?? []);
  if (allowed.size === 0) return [];

  return all.filter((location) => allowed.has(location.id));
}

export function userLocationIds(args: Parameters<typeof userLocationOptions>[0]): number[] {
  return userLocationOptions(args).map((location) => location.id);
}

export function locationExists(slug: string, locationId: number, bookingOnly = false): boolean {
  return tenantLocations(slug, bookingOnly).some((location) => location.id === locationId);
}

export function locationAllowedForUser({
  slug,
  locationId,
  user = demoAdminUser,
  bookingOnly = false,
}: {
  slug: string;
  locationId: number;
  user?: DemoUser | null;
  bookingOnly?: boolean;
}): boolean {
  if (locationId <= 0 || !locationExists(slug, locationId, bookingOnly)) return false;
  if (!user) return true;
  return userLocationIds({ slug, user, bookingOnly }).includes(locationId);
}

export function singleUserLocationId({
  slug,
  user = demoAdminUser,
  bookingOnly = false,
}: {
  slug: string;
  user?: DemoUser | null;
  bookingOnly?: boolean;
}): number {
  const ids = userLocationIds({ slug, user, bookingOnly });
  return ids.length === 1 ? ids[0] : 0;
}

export function resolveLocationId({
  slug,
  raw,
  currentLocationId = 0,
  fallbackCurrent = true,
  user = demoAdminUser,
  bookingOnly = false,
}: {
  slug: string;
  raw?: string | number | null;
  currentLocationId?: number;
  fallbackCurrent?: boolean;
  user?: DemoUser | null;
  bookingOnly?: boolean;
}): number {
  const hasRaw = raw !== null && raw !== undefined && String(raw).trim() !== "";
  const rawId = Number.parseInt(String(raw ?? "0"), 10);

  if (rawId > 0) {
    return locationAllowedForUser({ slug, locationId: rawId, user, bookingOnly }) ? rawId : 0;
  }

  if (hasRaw) return 0;

  if (fallbackCurrent && currentLocationId > 0 && locationAllowedForUser({ slug, locationId: currentLocationId, user, bookingOnly })) {
    return currentLocationId;
  }

  return singleUserLocationId({ slug, user, bookingOnly });
}

export function currentLocationId(args: Omit<Parameters<typeof resolveLocationId>[0], "raw">): number {
  return resolveLocationId({ ...args, raw: null, fallbackCurrent: true });
}

export function locationSelectionRequired({
  slug,
  currentLocationId: selectedLocationId = 0,
  user = demoAdminUser,
  bookingOnly = false,
}: {
  slug: string;
  currentLocationId?: number;
  user?: DemoUser | null;
  bookingOnly?: boolean;
}): boolean {
  const ids = userLocationIds({ slug, user, bookingOnly });
  if (ids.length <= 1) return false;
  return selectedLocationId <= 0 || !ids.includes(selectedLocationId);
}

export function locationLabel(slug: string, locationId: number): string {
  return tenantLocations(slug).find((location) => location.id === locationId)?.name ?? "Tutte le sedi";
}
