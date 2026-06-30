import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { consumeDbClientPackage, issueDbClientPackage, listDbPackageState } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const packageReadPerms = ["packages.access", "packages.clients", "packages.catalog", "pos.manage"];
const packageWritePerms = ["packages.clients", "pos.manage"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, packageReadPerms)) return jsonError("Permesso pacchetti mancante.", 403);

  try {
    return Response.json({
      ok: true,
      sourceMode: "database",
      ...await listDbPackageState(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore pacchetti.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, packageWritePerms)) return jsonError("Permesso pacchetti mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "issue";

  try {
    if (action === "issue") {
      const input = {
        packageId: parseInteger(body.package_id, 0),
        clientId: parseInteger(body.client_id, 0),
        clientName: body.client_name,
        expiresAt: body.expires_at,
      };
      const clientPackage = await issueDbClientPackage(input, tenantSlug);
      return Response.json({ ok: true, source: "packages?action=issue", sourceMode: "database", clientPackage, ...await listDbPackageState(tenantSlug) });
    }

    if (action === "use") {
      const id = parseInteger(body.id);
      const sessions = parseInteger(body.sessions, 1);
      const clientPackage = await consumeDbClientPackage(id, sessions, tenantSlug);
      return Response.json({ ok: true, source: "packages?action=use", sourceMode: "database", clientPackage, ...await listDbPackageState(tenantSlug) });
    }

    return jsonError("Azione pacchetti non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore pacchetti.");
  }
}
