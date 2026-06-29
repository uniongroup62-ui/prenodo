import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { listDbConfigModule, toggleDbConfigRecord, touchDbConfigModule } from "@/lib/db-repositories";
import { applyExistingPreorders, applyExistingPrepaids, getManagePosSettings, saveManagePosSettings } from "@/lib/manage-pos-settings";
import { can, permissionForFeature } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("module") ?? "custom";
  if (!can(session.user.perms, permissionForFeature(moduleId))) return jsonError("Permesso configurazione mancante.", 403);

  try {
    const moduleState = moduleId === "pos_settings"
      ? await getManagePosSettings(tenantSlug)
      : await listDbConfigModule(moduleId, tenantSlug);

    return Response.json({
      ok: true,
      source: `app/pages/${moduleState.source}`,
      sourceMode: "database",
      module: moduleState,
      records: moduleState.records,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore configurazione.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);

  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const moduleId = body.module ?? url.searchParams.get("module") ?? "custom";
  if (!can(session.user.perms, permissionForFeature(moduleId))) return jsonError("Permesso configurazione mancante.", 403);

  const action = body.action ?? "touch";

  try {
    if (moduleId === "pos_settings") {
      if (action === "save" || action === "save_pos_expiry_settings") {
        const moduleState = await saveManagePosSettings(tenantSlug, body, session.user.id);
        return Response.json({ ok: true, source: "pos_settings?action=save_pos_expiry_settings", sourceMode: "database", module: moduleState, records: moduleState.records });
      }

      if (action === "apply_existing_preorders") {
        const { count, module } = await applyExistingPreorders(tenantSlug);
        return Response.json({ ok: true, source: "pos_settings?action=apply_existing_preorders", sourceMode: "database", count, module, records: module.records });
      }

      if (action === "apply_existing_prepaids") {
        const { count, module } = await applyExistingPrepaids(tenantSlug);
        return Response.json({ ok: true, source: "pos_settings?action=apply_existing_prepaids", sourceMode: "database", count, module, records: module.records });
      }

      const moduleState = await getManagePosSettings(tenantSlug);
      return Response.json({ ok: true, source: "pos_settings", sourceMode: "database", module: moduleState, records: moduleState.records });
    }

    if (action === "toggle") {
      const recordId = parseInteger(body.record_id ?? body.id);
      const active = ["1", "true", "yes", "on"].includes((body.active ?? "").toLowerCase());
      const moduleState = await toggleDbConfigRecord(moduleId, recordId, active, tenantSlug);
      return Response.json({ ok: true, source: `configuration?action=toggle&module=${moduleId}`, sourceMode: "database", module: moduleState, records: moduleState.records });
    }

    const moduleState = await touchDbConfigModule(moduleId, tenantSlug);
    return Response.json({ ok: true, source: `configuration?action=touch&module=${moduleId}`, sourceMode: "database", module: moduleState, records: moduleState.records });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore configurazione.");
  }
}
