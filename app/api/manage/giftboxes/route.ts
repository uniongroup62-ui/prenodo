import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { issueDbGiftBox, listDbGiftBoxes, redeemDbGiftBox } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const giftBoxPerms = ["giftbox.manage", "pos.manage"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftBoxPerms)) return jsonError("Permesso GiftBox mancante.", 403);

  try {
    return Response.json({
      ok: true,
      source: "app/pages/giftbox.php",
      sourceMode: "database",
      giftBoxes: await listDbGiftBoxes(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore GiftBox.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftBoxPerms)) return jsonError("Permesso GiftBox mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "issue";

  try {
    if (action === "issue") {
      const input = {
        clientId: parseInteger(body.client_id, 0),
        recipientName: body.recipient_name,
        serviceId: parseInteger(body.service_id, 0),
        sessions: parseInteger(body.sessions, 1),
        expiresAt: body.expires_at,
      };
      const giftBox = await issueDbGiftBox(input, tenantSlug);
      return Response.json({ ok: true, source: "giftbox?action=issue", sourceMode: "database", giftBox, giftBoxes: await listDbGiftBoxes(tenantSlug) });
    }

    if (action === "redeem") {
      const id = parseInteger(body.id);
      const quantity = parseInteger(body.quantity, 1);
      const giftBox = await redeemDbGiftBox(id, quantity, tenantSlug);
      return Response.json({ ok: true, source: "giftbox?action=redeem", sourceMode: "database", giftBox, giftBoxes: await listDbGiftBoxes(tenantSlug) });
    }

    return jsonError("Azione GiftBox non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore GiftBox.");
  }
}
