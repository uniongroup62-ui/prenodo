import { NextResponse } from "next/server";
import { clearManageSessionCookie } from "@/lib/manage-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /<slug>/logout — the manage-shell logout link. Clears the tenant's manage
// session cookie and redirects to the login page. A dedicated `logout` segment
// takes precedence over the [...segments] catch-all (which otherwise fell through
// to the dashboard, so the link never actually logged the user out).
export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  await clearManageSessionCookie(tenantSlug);
  return NextResponse.redirect(new URL(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`, request.url));
}
