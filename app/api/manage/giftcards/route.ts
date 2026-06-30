import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { issueDbGiftCard, listDbGiftCards, redeemDbGiftCard } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const giftCardPerms = ["giftcard.manage", "pos.manage"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftCardPerms)) return jsonError("Permesso GiftCard mancante.", 403);

  try {
    return Response.json({
      ok: true,
      sourceMode: "database",
      giftCards: await listDbGiftCards(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore GiftCard.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftCardPerms)) return jsonError("Permesso GiftCard mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "issue";

  try {
    if (action === "issue") {
      const input = {
        clientId: parseInteger(body.client_id, 0),
        recipientName: body.recipient_name,
        initialAmount: parseNumber(body.amount, 0),
        expiresAt: body.expires_at,
      };
      const giftCard = await issueDbGiftCard(input, tenantSlug);
      return Response.json({ ok: true, source: "giftcard?action=issue", sourceMode: "database", giftCard, giftCards: await listDbGiftCards(tenantSlug) });
    }

    if (action === "redeem") {
      const id = parseInteger(body.id);
      const amount = parseNumber(body.amount, 0);
      const giftCard = await redeemDbGiftCard(id, amount, tenantSlug);
      return Response.json({ ok: true, source: "giftcard?action=redeem", sourceMode: "database", giftCard, giftCards: await listDbGiftCards(tenantSlug) });
    }

    return jsonError("Azione GiftCard non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore GiftCard.");
  }
}
