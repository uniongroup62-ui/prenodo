import "server-only";

import { tenantSlug as defaultTenantSlug } from "@/lib/tenant-runtime";

export function manageTenantSlugFromRequest(request: Request): string {
  const url = new URL(request.url);
  const explicit = normalizeSlug(url.searchParams.get("slug") || request.headers.get("x-tenant-slug") || "");
  if (explicit) return explicit;

  const referer = request.headers.get("referer") || request.headers.get("referrer") || "";
  const fromReferer = slugFromUrl(referer);
  if (fromReferer) return fromReferer;

  return defaultTenantSlug;
}

function slugFromUrl(value: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return normalizeSlug(firstSegment);
  } catch {
    return "";
  }
}

function normalizeSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["api", "manage", "account", "attivita", "admin"].includes(normalized)) return "";
  return normalized.replace(/[^a-z0-9_-]/g, "").slice(0, 80);
}

