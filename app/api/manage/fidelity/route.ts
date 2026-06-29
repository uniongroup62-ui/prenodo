import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { addDbWalletMovement, dbWalletBalance, listDbClients, listDbWalletMovements } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";
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
    const clients = await listDbClients({ slug: tenantSlug });
    return Response.json({
      ok: true,
      source: "app/pages/fidelity.php + app/pages/wallet.php + app/pages/recharges.php",
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
