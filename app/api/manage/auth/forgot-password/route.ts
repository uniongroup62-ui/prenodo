import { headers } from "next/headers";
import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { requestManagePasswordReset } from "@/lib/manage-password-reset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";
  const origin = headerStore.get("origin") || new URL(request.url).origin;

  try {
    const result = await requestManagePasswordReset({
      slug: body.slug ?? "",
      email: body.email ?? "",
      ip,
      userAgent: headerStore.get("user-agent") ?? "",
      origin,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Reset password non disponibile.", 400);
  }
}
