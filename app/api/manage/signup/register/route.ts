import { headers } from "next/headers";
import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { registerManageSignup } from "@/lib/manage-signup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";

  try {
    const result = await registerManageSignup({
      businessName: body.business_name ?? "",
      slug: body.slug ?? "",
      ownerName: body.owner_name ?? "",
      ownerEmail: body.owner_email ?? body.email ?? "",
      ownerPhone: body.owner_phone ?? "",
      password: body.password ?? "",
      passwordConfirm: body.password_confirm ?? "",
      terms: body.terms === "1" || body.terms === "true" || body.terms === "on",
      marketingOptIn: body.marketing_opt_in === "1" || body.marketing_opt_in === "true" || body.marketing_opt_in === "on",
      ip,
      userAgent: headerStore.get("user-agent") ?? "",
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Registrazione non disponibile.", 400);
  }
}

