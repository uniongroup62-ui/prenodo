import { headers } from "next/headers";
import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { loginManageUser, setManageSessionCookie } from "@/lib/manage-auth";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";

  const result = await loginManageUser({
    slug: body.slug ?? "",
    email: body.email ?? "",
    password: body.password ?? "",
    ip,
  });

  if (!result.ok) return jsonError(result.error, 401);

  await setManageSessionCookie(result.session);
  return Response.json({
    ok: true,
    redirectTo: result.redirectTo,
    user: result.session.user,
    source: result.source,
  });
}
