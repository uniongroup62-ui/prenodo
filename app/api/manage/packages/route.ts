import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { consumeDbClientPackage, deleteManagePackageCatalog, issueDbClientPackage, listDbPackageState, listManagePackageCatalog } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const packageReadPerms = ["packages.access", "packages.clients", "packages.catalog", "pos.manage"];
const packageWritePerms = ["packages.clients", "pos.manage"];
const packageCatalogPerms = ["packages.catalog", "pos.manage"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, packageReadPerms)) return jsonError("Permesso pacchetti mancante.", 403);

  try {
    const url = new URL(request.url);

    // Faithful catalog LIST (tab=catalog): the package templates + contents/sedi/
    // price/validity/sold columns.
    if (url.searchParams.get("action") === "catalog") {
      if (!canAny(session.user.perms, packageCatalogPerms)) return jsonError("Permesso catalogo pacchetti mancante.", 403);
      return Response.json({ ok: true, sourceMode: "database", catalog: await listManagePackageCatalog(tenantSlug) });
    }

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
  // Top gate: any package write permission (clients OR catalog OR pos); each
  // action re-checks its finer permission below.
  if (!canAny(session.user.perms, [...packageWritePerms, ...packageCatalogPerms])) return jsonError("Permesso pacchetti mancante.", 403);

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

    // Delete a catalog template (port of action=catalog_delete): detach client
    // packages + drop the template's child rows. Gated by packages.catalog.
    if (action === "catalog_delete") {
      if (!canAny(session.user.perms, packageCatalogPerms)) return jsonError("Permesso catalogo pacchetti mancante.", 403);
      await deleteManagePackageCatalog(tenantSlug, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "packages?action=catalog_delete", sourceMode: "database", catalog: await listManagePackageCatalog(tenantSlug) });
    }

    return jsonError("Azione pacchetti non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore pacchetti.");
  }
}
