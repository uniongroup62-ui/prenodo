import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import type { ManagedClient } from "@/lib/tenant-store";
import {
  archiveDbClient,
  blockDbClient,
  createDbClient,
  deleteDbClientCascade,
  getDbClient,
  getManageClientDeleteSummary,
  getManageClientDetail,
  listDbClients,
  quickBookClientContext,
  unblockDbClient,
  updateDbClient,
} from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "clients.manage")) return jsonError("Permesso clienti mancante.", 403);

  const url = new URL(request.url);
  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: url.searchParams.get("location_id"),
    fallbackCurrent: true,
  });

  // Quick-booking drawer CLIENT HISTORY + RESIDUALS panels. Single GET that
  // returns BOTH the legacy `action=history` (summary) and `action=residuals`
  // (summary=1) payloads for one client, so the drawer can populate both boxes
  // with a single fetch. Port of api_clients.php history/residuals summaries.
  if (url.searchParams.get("action") === "quickbook_client_context") {
    const clientId = parseInteger(url.searchParams.get("client_id"));
    if (clientId <= 0) return jsonError("client_id mancante.");
    try {
      const context = await quickBookClientContext({ slug: tenantSlug, clientId, locationId });
      return Response.json({
        ok: true,
        source: "app/pages/api_clients.php action=history + action=residuals (summary)",
        sourceMode: "database",
        summary: context.history,
        residuals: context.residuals,
        // Available packages for the drawer's per-service "Usa pacchetto" control
        // (port of api_clients.php action=residuals package block; see
        // quickBookClientPackages). Each carries the covered service_ids.
        packages: context.packages,
        // Available prepaid-service balances for the drawer's per-service "Usa
        // prepagato" control (port of api_clients.php action=residuals prepaid block;
        // see quickBookClientPrepaids). Each is tied to ONE service (service_id).
        prepaids: context.prepaids,
        // Available giftcards for the drawer's APPOINTMENT-LEVEL "GiftCard" control
        // (port of api_clients.php action=residuals giftcard block; see
        // quickBookClientGiftcards). Each carries a spendable monetary balance.
        giftcards: context.giftcards,
        // Available giftbox ITEMS for the drawer's per-service "Usa GiftBox" control
        // (see quickBookClientGiftboxes). GiftBox is per-service + ITEM-based; each
        // entry covers exactly its service_id and pins the redeem via
        // instance_id + giftbox_item_id.
        giftboxes: context.giftboxes,
        // Available GIFT (omaggio) SERVICE REWARDS for the drawer's per-service "Usa
        // Omaggio" control (see quickBookClientGifts). A gift instance holds reward items;
        // each entry is a still-available service reward covering its service_id, pinned by
        // instance_id + reward_item_index (the reward's array index in reward_items_json).
        gifts: context.gifts,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore contesto cliente.");
    }
  }

  // Faithful client DETAIL (action=view) reader. Port of clients.php action=view:
  // the full anagrafica + fidelity points/credit + tags + block status + the
  // appointments/sales history summary + residuals (active packages/prepaids/
  // giftcards/giftbox/gifts + credit) for the header card and history sections.
  if (url.searchParams.get("action") === "detail") {
    const clientId = parseInteger(url.searchParams.get("id"));
    if (clientId <= 0) return jsonError("ID cliente mancante.");
    try {
      const detail = await getManageClientDetail(tenantSlug, clientId);
      if (!detail) return jsonError("Cliente non trovato.", 404);
      return Response.json({ ok: true, source: "clients.php action=view", sourceMode: "database", ...detail });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore dettaglio cliente.");
    }
  }

  // Delete-cascade SUMMARY (port of clients.php delete-confirm ~1215-1248): the
  // counts of what WILL be deleted/affected, so the UI confirm can warn before
  // the actual POST action=delete.
  if (url.searchParams.get("action") === "delete_summary") {
    const clientId = parseInteger(url.searchParams.get("id"));
    if (clientId <= 0) return jsonError("ID cliente mancante.");
    try {
      const summary = await getManageClientDeleteSummary(tenantSlug, clientId);
      return Response.json({ ok: true, source: "clients.php action=delete_confirm", sourceMode: "database", summary });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore riepilogo eliminazione.");
    }
  }

  // Edit-form prefill: return the full client anagrafica for one id. Port of
  // clients.php action=edit (client_load_accessible + client_profile_defaults).
  if (url.searchParams.get("action") === "get") {
    const clientId = parseInteger(url.searchParams.get("id"));
    if (clientId <= 0) return jsonError("ID cliente mancante.");
    try {
      const client = await getDbClient(clientId, tenantSlug);
      if (!client) return jsonError("Cliente non trovato.", 404);
      return Response.json({ ok: true, source: "clients?action=get", sourceMode: "database", client });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore cliente.");
    }
  }

  const args = {
    slug: tenantSlug,
    query: url.searchParams.get("q") ?? "",
    locationId,
    includeArchived: ["1", "true", "yes"].includes((url.searchParams.get("include_archived") ?? "").toLowerCase()),
  };

  try {
    return Response.json({
      ok: true,
      source: "app/pages/clients.php + app/pages/api_clients.php",
      sourceMode: "database",
      clients: await listDbClients(args),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore clienti.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "clients.manage")) return jsonError("Permesso clienti mancante.", 403);

  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "create");

  try {
    if (action === "create") {
      const input = await clientInputFromBody(body, tenantSlug);
      const client = await createDbClient(input, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=create", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    const id = parseInteger(body.id);
    if (id <= 0) return jsonError("ID cliente mancante.");

    if (action === "update") {
      const input = await clientInputFromBody(body, tenantSlug);
      const client = await updateDbClient(id, input, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=update", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    if (action === "archive") {
      const client = await archiveDbClient(id, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=archive", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    // Disattiva cliente (port of clients.php _mode=block_client): is_blocked=1 +
    // blocked_at=now + a REQUIRED internal note. The blocked client drops out of
    // the default list (listDbClients hides is_blocked=1).
    if (action === "block") {
      const note = String(body.blocked_internal_note ?? body.reason ?? "");
      const client = await blockDbClient(id, tenantSlug, note);
      return Response.json({ ok: true, source: "clients?action=block", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    // Riattiva cliente (port of clients.php _mode=unblock_client): is_blocked=0,
    // clears blocked_at + note. No associated data is touched.
    if (action === "unblock") {
      const client = await unblockDbClient(id, tenantSlug);
      return Response.json({ ok: true, source: "clients?action=unblock", sourceMode: "database", client, clients: await listDbClients({ slug: tenantSlug }) });
    }

    if (action === "delete") {
      // Faithful, ATOMIC cascade (port of clients.php client_delete_execute). The
      // reason is REQUIRED (legacy guard) — reject an empty one. stock_restore_mode
      // selects whether the sales' product stock is restored ('restore_stock') or
      // left ('no_restore', default). deleteDbClientCascade throws on an empty reason.
      const reason = String(body.delete_reason ?? body.reason ?? "").trim();
      if (reason === "") return jsonError("La motivazione è obbligatoria.");
      const stockRestoreMode = String(body.stock_restore_mode ?? "") === "restore_stock" ? "restore_stock" : "no_restore";
      const result = await deleteDbClientCascade(tenantSlug, id, { reason, stockRestoreMode });
      return Response.json({ ok: true, source: "clients?action=delete", sourceMode: "database", ...result, clients: await listDbClients({ slug: tenantSlug }) });
    }

    return jsonError("Azione clienti non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore clienti.");
  }
}

async function clientInputFromBody(body: Record<string, string>, tenantSlug: string): Promise<Partial<ManagedClient>> {
  const locationId = await resolveManageLocationId({
    slug: tenantSlug,
    raw: body.location_id === undefined ? null : body.location_id,
    fallbackCurrent: true,
  });

  return {
    name: body.name ?? body.client_name ?? body.full_name,
    email: body.email,
    phone: body.phone,
    locationId,
    lastVisit: body.last_visit,
    value: body.value,
    next: body.next,
    note: body.note ?? body.notes,
    tags: body.tags ? body.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
    // Full anagrafica (port of clients.php new/edit $_POST fields).
    firstName: body.first_name,
    lastName: body.last_name,
    companyName: body.company_name,
    vatNumber: body.vat_number,
    taxCode: body.tax_code,
    sdi: body.sdi,
    pec: body.pec,
    phoneHome: body.phone_home,
    phone2: body.phone2,
    gender: body.gender,
    birthDate: body.birth_date,
    birthPlace: body.birth_place,
    registrationDate: body.registration_date,
    region: body.region,
    province: body.province,
    city: body.city,
    address: body.address,
    cap: body.cap,
    jobTitle: body.job_title,
  };
}
