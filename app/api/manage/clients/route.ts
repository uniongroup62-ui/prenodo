import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import type { ManagedClient } from "@/lib/tenant-store";
import {
  archiveDbClient,
  createDbClient,
  deleteDbClient,
  listDbClients,
  quickBookClientContext,
  updateDbClient,
} from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "clients.manage")) return jsonError("Permesso clienti mancante.", 403);

  const url = new URL(request.url);
  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: url.searchParams.get("location_id"),
    fallbackCurrent: true,
  });

  // Quick-booking drawer CLIENT HISTORY + RESIDUALS panels. Single GET that
  // returns BOTH the legacy `action=history` (summary) and `action=residuals`
  // (summary=1) payloads for one client, so the drawer can populate both boxes
  // with a single fetch. Port of api_clients.php history/residuals summaries.
  if (url.searchParams.get("action") === "quickbook_client_context") {
    const clientId = parseInteger(url.searchParams.get("client_id"));
    if (clientId <= 0) return jsonError("client_id mancante.");
    try {
      const context = await quickBookClientContext({ slug: tenantSlug, clientId, locationId });
      return Response.json({
        ok: true,
        source: "app/pages/api_clients.php action=history + action=residuals (summary)",
        sourceMode: "database",
        summary: context.history,
        residuals: context.residuals,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore contesto cliente.");
    }
  }

  const args = {
    slug: tenantSlug,
    query: url.searchParams.get("q") ?? "",
    locationId,
    includeArchived: ["1", "true", "yes"].includes((url.searchParams.get("include_archived") ?? "").toLowerCase()),
  };

  try {
    return Response.json({
      ok: true,
      source: "app/pages/clients.php + app/pages/api_clients.php",
      sourceMode: "database",
      clients: await listDbClients(args),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore clienti.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "clients.manage")) return jsonError("Permesso clienti mancante.", 403);

  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "create");

  try {
    if (action === "create") {
      const input = await clientInputFromBody(body, tenantSlug);
      const client = await createDbClient(input, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=create", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    const id = parseInteger(body.id);
    if (id <= 0) return jsonError("ID cliente mancante.");

    if (action === "update") {
      const input = await clientInputFromBody(body, tenantSlug);
      const client = await updateDbClient(id, input, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=update", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    if (action === "archive") {
      const client = await archiveDbClient(id, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=archive", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    if (action === "delete") {
      const result = await deleteDbClient(id, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=delete", sourceMode: "database", ...result, clients: await listDbClients({ slug: tenantSlug }) });
    }

    return jsonError("Azione clienti non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore clienti.");
  }
}

async function clientInputFromBody(body: Record<string, string>, tenantSlug: string): Promise<Partial<ManagedClient>> {
  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: body.location_id === undefined ? null : body.location_id,
    fallbackCurrent: true,
  });

  return {
    name: body.name ?? body.client_name,
    email: body.email,
    phone: body.phone,
    locationId,
    lastVisit: body.last_visit,
    value: body.value,
    next: body.next,
    note: body.note,
    tags: body.tags ? body.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
  };
}
