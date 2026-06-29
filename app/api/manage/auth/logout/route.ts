import { parseRequestBody } from "@/lib/api-utils";
import { clearManageSessionCookie } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  await clearManageSessionCookie(body.slug || manageTenantSlugFromRequest(request));
  return Response.json({ ok: true });
}
