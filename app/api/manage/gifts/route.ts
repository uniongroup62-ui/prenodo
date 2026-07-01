import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { deleteManageGift, getManageGift, giftFormCatalog, issueDbGift, listDbGifts, listManageGifts, redeemDbGift, saveManageGift, toggleManageGift } from "@/lib/db-repositories";
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

    // Gift CAMPAIGN list (port of gifts.php default view / Gifts::listGifts).
    if (action === "campaigns") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      return Response.json({ ok: true, sourceMode: "database", campaigns: await listManageGifts(tenantSlug) });
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

    // Campaign activate/deactivate (port of gifts.php action=toggle_active).
    if (action === "toggle_active" || action === "toggle") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      const active = ["1", "true", "on", "yes"].includes(String(body.active ?? "").toLowerCase());
      const result = await toggleManageGift(tenantSlug, parseInteger(body.id, 0), active, session.user.id);
      return Response.json({ sourceMode: "database", ...result, campaigns: await listManageGifts(tenantSlug) });
    }

    // Campaign delete (port of gifts.php action=delete / Gifts::softDeleteGift).
    if (action === "delete" || action === "delete_campaign") {
      if (!can(session.user.perms, "gifts.manage")) return jsonError("Permesso omaggi mancante.", 403);
      const result = await deleteManageGift(tenantSlug, parseInteger(body.id, 0), session.user.id);
      return Response.json({ sourceMode: "database", ...result, campaigns: await listManageGifts(tenantSlug) });
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
