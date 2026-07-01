import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { commissionDbSummary, listDbCommissions, markDbCommissionPaid } from "@/lib/db-repositories";
import { getCommissionSettings, saveCommissionSettings, setCommissionModuleEnabled, type CommissionStaffSettingInput } from "@/lib/manage-commissions";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "commissions.manage")) return jsonError("Permesso commissioni mancante.", 403);

  const url = new URL(request.url);

  try {
    // Settings tab (Impostazioni operatori): the module toggle + per-operator rate config.
    if (url.searchParams.get("action") === "settings") {
      return Response.json({ ok: true, sourceMode: "database", settings: await getCommissionSettings(tenantSlug) });
    }
    return Response.json({
      ok: true,
      sourceMode: "database",
      summary: await commissionDbSummary(tenantSlug),
      commissions: await listDbCommissions(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore commissioni.");
  }
}

// Parse the settings rows map (nested per-staff config) from a JSON string body field — nested so it
// survives parseRequestBody (which flattens a top-level object to "[object Object]").
function parseCommissionRows(raw: unknown): Record<string, CommissionStaffSettingInput> {
  let src: unknown = raw;
  if (typeof src === "string") {
    try { src = JSON.parse(src); } catch { return {}; }
  }
  if (!src || typeof src !== "object") return {};
  return src as Record<string, CommissionStaffSettingInput>;
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "commissions.manage")) return jsonError("Permesso commissioni mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "pay";

  try {
    if (action === "pay") {
      const id = parseInteger(body.id);
      const commission = await markDbCommissionPaid(id, tenantSlug);
      return Response.json({
        ok: true,
        source: "commissions?action=pay",
        sourceMode: "database",
        commission,
        summary: await commissionDbSummary(tenantSlug),
        commissions: await listDbCommissions(tenantSlug),
      });
    }

    // Settings tab writes: the global module toggle + per-operator rate config.
    if (action === "save_module_settings" || action === "save_module") {
      const enabled = ["1", "true", "yes", "on"].includes(String(body.module_enabled ?? body.enabled ?? "").toLowerCase());
      return Response.json({ ok: true, sourceMode: "database", settings: await setCommissionModuleEnabled(tenantSlug, enabled, session.user.id) });
    }

    if (action === "save_commission_settings" || action === "save_settings") {
      const settings = await saveCommissionSettings(tenantSlug, parseCommissionRows(body.rows ?? body.rows_json), session.user.id);
      return Response.json({ ok: true, sourceMode: "database", settings });
    }

    return jsonError("Azione commissioni non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore commissioni.");
  }
}
