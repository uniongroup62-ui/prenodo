import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { issueDbGift, listDbGifts, redeemDbGift } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GiftRewardType = "service" | "product" | "discount";
const giftPerms = ["gifts.manage", "pos.manage"];

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftPerms)) return jsonError("Permesso omaggi mancante.", 403);

  try {
    return Response.json({
      ok: true,
      source: "app/pages/gifts.php",
      sourceMode: "database",
      gifts: await listDbGifts(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore omaggi.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, giftPerms)) return jsonError("Permesso omaggi mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "issue";

  try {
    if (action === "issue") {
      const input = {
        clientId: parseInteger(body.client_id, 0),
        clientName: body.client_name,
        title: body.title,
        rewardType: normalizeRewardType(body.reward_type),
        value: parseNumber(body.value, 0),
        expiresAt: body.expires_at,
      };
      const gift = await issueDbGift(input, tenantSlug);
      return Response.json({ ok: true, source: "gifts?action=issue", sourceMode: "database", gift, gifts: await listDbGifts(tenantSlug) });
    }

    if (action === "redeem") {
      const id = parseInteger(body.id);
      const gift = await redeemDbGift(id, tenantSlug);
      return Response.json({ ok: true, source: "gifts?action=redeem", sourceMode: "database", gift, gifts: await listDbGifts(tenantSlug) });
    }

    return jsonError("Azione omaggi non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore omaggi.");
  }
}

function normalizeRewardType(value: string | undefined): GiftRewardType {
  if (value === "service" || value === "product" || value === "discount") return value;
  return "discount";
}
