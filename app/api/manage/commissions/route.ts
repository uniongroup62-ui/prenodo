import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { commissionDbSummary, listDbCommissions, markDbCommissionPaid } from "@/lib/db-repositories";
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

  try {
    return Response.json({
      ok: true,
      source: "app/pages/commissions.php",
      sourceMode: "database",
      summary: await commissionDbSummary(tenantSlug),
      commissions: await listDbCommissions(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore commissioni.");
  }
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

    return jsonError("Azione commissioni non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore commissioni.");
  }
}
