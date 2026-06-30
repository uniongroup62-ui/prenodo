import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { getManageGift, giftFormCatalog, issueDbGift, listDbGifts, redeemDbGift, saveManageGift } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";

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
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Campaign editor catalog (services/products/locations for the item + sedi
    // dropdowns). Port of the SELECTs in gifts.php action=new|edit.
    if (action === "context") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      return Response.json({ ok: true, sourceMode: "database", ...(await giftFormCatalog(tenantSlug)) });
    }

    // Edit-form prefill: ONE gift campaign's editable fields. Port of gifts.php
    // action=edit. Gated by gifts.manage like the save action.
    if (action === "get") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      const giftId = parseInteger(url.searchParams.get("id"), 0);
      if (giftId <= 0) return jsonError("ID campagna mancante.");
      const gift = await getManageGift(tenantSlug, giftId);
      if (!gift) return jsonError("Campagna non trovata.", 404);
      return Response.json({ ok: true, source: "gifts?action=get", sourceMode: "database", gift });
    }

    return Response.json({
      ok: true,
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
    // Faithful gift CAMPAIGN editor save (port of gifts.php POST action=new|edit
    // / Gifts::saveGift). id=0 creates, id>0 updates. Gated by gifts.manage.
    if (action === "save" || action === "new" || action === "edit") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      const gift = await saveManageGift(tenantSlug, body, parseInteger(body.id, 0));
      return Response.json({ ok: true, source: "gifts?action=save", sourceMode: "database", gift, gifts: await listDbGifts(tenantSlug) });
    }

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
