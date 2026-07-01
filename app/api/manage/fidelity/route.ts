import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { addDbWalletMovement, dbWalletBalance, getFidelityEnabled, listDbClients, listDbWalletMovements, setFidelityEnabled } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";
import type { WalletMovementType } from "@/lib/tenant-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const readPerms = ["fidelity.manage", "fidelity.wallet", "fidelity.recharges", "fidelity.points", "pos.manage"];
const writePerms = ["fidelity.manage", "fidelity.wallet", "fidelity.recharges", "fidelity.points"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, readPerms)) return jsonError("Permesso fidelity mancante.", 403);

  try {
    const url = new URL(request.url);
    // Global Fidelity enabled flag (for the main fidelity.php page toggle).
    if (url.searchParams.get("action") === "state") {
      return Response.json({ ok: true, sourceMode: "database", enabled: await getFidelityEnabled(tenantSlug) });
    }

    const clients = await listDbClients({ slug: tenantSlug });
    return Response.json({
      ok: true,
      sourceMode: "database",
      clients: await Promise.all(clients.map(async (client) => ({ ...client, wallet: await dbWalletBalance(client.id, tenantSlug) }))),
      movements: await listDbWalletMovements(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore fidelity.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, writePerms)) return jsonError("Permesso fidelity mancante.", 403);

  const body = await parseRequestBody(request);
  try {
    // Global Fidelity toggle (port of fidelity.php _mode=toggle_fidelity).
    if (body.action === "toggle" || body._mode === "toggle_fidelity") {
      if (!can(session.user.perms, "fidelity.manage")) return jsonError("Permesso fidelity mancante.", 403);
      const enabled = ["1", "true", "on", "yes"].includes(String(body.fidelity_enabled ?? body.enabled ?? "").toLowerCase());
      const confirmed = ["1", "true", "on", "yes"].includes(String(body.disable_appointments_confirmed ?? body.confirmed ?? "").toLowerCase());
      const result = await setFidelityEnabled(tenantSlug, enabled, confirmed);
      return Response.json({ sourceMode: "database", ...result });
    }

    const input = {
      clientId: parseInteger(body.client_id, 0),
      type: normalizeMovementType(body.type),
      amount: parseNumber(body.amount, 0),
      points: parseInteger(body.points, 0),
      note: body.note,
      source: body.source ?? "manual",
    };
    const movement = await addDbWalletMovement(input, tenantSlug);
    return Response.json({ ok: true, source: "wallet?action=movement", sourceMode: "database", movement, movements: await listDbWalletMovements(tenantSlug) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore fidelity.");
  }
}

function normalizeMovementType(value: string | undefined): WalletMovementType {
  if (value === "recharge" || value === "debit" || value === "points_earn" || value === "points_redeem") return value;
  return "adjustment";
}
