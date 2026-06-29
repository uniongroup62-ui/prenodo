import { NextResponse } from "next/server";
import { signupSlugAvailability } from "@/lib/manage-signup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get("slug") || url.searchParams.get("business_name") || "";
  const businessName = url.searchParams.get("business_name") || "";
  const availability = await signupSlugAvailability(rawSlug, businessName, 4);

  return NextResponse.json({
    ok: true,
    available: availability.available,
    slug: availability.slug,
    sourceMode: "database",
    reason: availability.reason,
    message: availability.message,
    suggestions: availability.suggestions,
  });
}
