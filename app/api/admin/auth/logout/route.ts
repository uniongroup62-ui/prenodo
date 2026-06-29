import { clearSaasAdminSessionCookie } from "@/lib/saas-admin-auth";

export async function POST() {
  await clearSaasAdminSessionCookie();
  return Response.json({ ok: true, redirectTo: "/admin/login" });
}
