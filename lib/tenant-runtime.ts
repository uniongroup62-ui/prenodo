// Tenant slug/session helpers.
//
// This module previously also exposed a hardcoded `tenantSlug =
// "centroesteticoelite"` default plus an in-memory location/user store seeded
// from the prototype's demo data. Both are gone: the app is purely DB-backed and
// multi-tenant-clean — no code defaults to a specific tenant. What remains are
// pure, tenant-agnostic string helpers used by the data layer and auth.

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
