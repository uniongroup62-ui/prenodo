import { headers } from "next/headers";
import { jsonError, parseRequestBody } from "@/lib/api-utils";
import {
  bootstrapSaasAdmin,
  isSaasBootstrapped,
  loginSaasAdmin,
  setSaasAdminSessionCookie,
} from "@/lib/saas-admin-auth";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";

  if (body.mode === "bootstrap" || !await isSaasBootstrapped()) {
    try {
      const session = await bootstrapSaasAdmin({
        name: body.name || "Admin",
        email: body.email || "",
        password: body.password || "",
      });
      await setSaasAdminSessionCookie(session);
      return Response.json({ ok: true, redirectTo: "/admin", user: session.user });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Bootstrap non riuscito.", 400);
    }
  }

  const result = await loginSaasAdmin({
    email: body.email || "",
    password: body.password || "",
    ip,
  });
  if (!result.ok) return jsonError(result.error, 401);

  await setSaasAdminSessionCookie(result.session);
  return Response.json({ ok: true, redirectTo: "/admin", user: result.session.user });
}
