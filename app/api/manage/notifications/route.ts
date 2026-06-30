import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { listDbNotifications, markDbNotificationRead } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "notifications.view")) return jsonError("Permesso notifiche mancante.", 403);

  try {
    return Response.json({
      ok: true,
      sourceMode: "database",
      notifications: await listDbNotifications(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore notifiche.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "notifications.view")) return jsonError("Permesso notifiche mancante.", 403);

  const body = await parseRequestBody(request);

  try {
    const id = parseInteger(body.id);
    const notification = await markDbNotificationRead(id, tenantSlug);
    return Response.json({ ok: true, source: "notifications?action=read", sourceMode: "database", notification, notifications: await listDbNotifications(tenantSlug) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore notifiche.");
  }
}
