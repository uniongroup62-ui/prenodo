import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { dbQuery } from "@/lib/tenant-db";

// Shared helpers for the Next cron routes that replace the legacy PHP
// cron/*.php scripts. Each job is an /api/cron/<job> route triggered by a
// scheduler (Vercel cron, Supabase pg_cron, or any external scheduler hitting
// the URL with the CRON_SECRET).

// Authorize a cron request. A scheduler must send `Authorization: Bearer
// <CRON_SECRET>` (Vercel cron does this automatically when CRON_SECRET is set)
// or `?key=<CRON_SECRET>`. If CRON_SECRET is unset (local dev) requests are
// allowed so the jobs can be exercised manually.
export function assertCronAuth(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const auth = request.headers.get("authorization") ?? "";
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (auth === `Bearer ${secret}` || key === secret) return;
  throw new Error("unauthorized");
}

// The Next equivalent of the PHP cron_active_tenants(): every active tenant.
export async function activeTenantSlugs(): Promise<string[]> {
  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT slug FROM saas_tenants WHERE COALESCE(is_active, 1) = 1 ORDER BY slug ASC",
  );
  return rows
    .map((row) => String(row.slug ?? "").trim().toLowerCase())
    .filter(Boolean);
}
