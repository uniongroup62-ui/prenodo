import { databaseStatus } from "@/lib/tenant-db";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";

export async function GET(request: Request) {
  return Response.json({
    ok: true,
    ...(await databaseStatus(manageTenantSlugFromRequest(request))),
  });
}
