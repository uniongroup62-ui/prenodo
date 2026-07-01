import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { convertDbQuoteToSale, createDbQuote, deleteDbQuote, getManageQuoteDetail, getManageQuoteForEdit, listDbClients, listDbProducts, listDbQuotes, listDbServices, sendQuoteEmail, updateDbQuote, updateDbQuoteStatus } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";
import type { PosSaleItemInput } from "@/lib/tenant-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "quotes.manage")) return jsonError("Permesso preventivi mancante.", 403);

  try {
    const url = new URL(request.url);

    // Editor context: the catalog the faithful Nuovo preventivo form needs —
    // clients (for the cliente picker) + services + products (for the line
    // items). Numeric prices are parsed from the managed catalog so the form can
    // seed an editable unit price per line.
    // Quote DETAIL (action=view): header + client + items + totals + linked sale.
    if (url.searchParams.get("action") === "view") {
      const detail = await getManageQuoteDetail(tenantSlug, parseInteger(url.searchParams.get("id"), 0));
      if (!detail) return jsonError("Preventivo non trovato.", 404);
      return Response.json({ ok: true, sourceMode: "database", detail });
    }

    // Edit-form prefill (action=edit): the quote in the CORE editor's shape.
    if (url.searchParams.get("action") === "edit_get") {
      const quote = await getManageQuoteForEdit(tenantSlug, parseInteger(url.searchParams.get("id"), 0));
      if (!quote) return jsonError("Preventivo non trovato.", 404);
      return Response.json({ ok: true, sourceMode: "database", quote });
    }

    if (url.searchParams.get("action") === "context") {
      const [clients, services, products] = await Promise.all([
        listDbClients({ slug: tenantSlug }),
        listDbServices({ slug: tenantSlug }),
        listDbProducts({ slug: tenantSlug }),
      ]);
      return Response.json({
        ok: true,
        sourceMode: "database",
        clients: clients.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })),
        services: services.map((s) => ({ id: s.id, name: s.name, price: priceFromManaged(s.price) })),
        products: products.map((p) => ({ id: p.id, name: p.name, price: priceFromManaged(p.price) })),
      });
    }

    return Response.json({
      ok: true,
      sourceMode: "database",
      quotes: await listDbQuotes(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore preventivi.");
  }
}

// The managed catalog formats price as a string (e.g. "30 euro" / "12.5 euro").
// Parse the leading number for the editor's editable unit-price seed.
function priceFromManaged(value: unknown): number {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  const n = match ? Number.parseFloat(match[0]) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "quotes.manage")) return jsonError("Permesso preventivi mancante.", 403);

  const body = await parseRequestBody(request);
  const action = body.action ?? "create";

  try {
    if (action === "create") {
      const quote = await createDbQuote({
        clientId: parseInteger(body.client_id, 0),
        clientName: body.client_name,
        discount: parseNumber(body.discount, 0),
        lines: quoteLinesFromBody(body),
      }, tenantSlug);
      return Response.json({ ok: true, source: "quotes?action=create", sourceMode: "database", quote, quotes: await listDbQuotes(tenantSlug) });
    }

    const id = parseInteger(body.id);
    if (id <= 0) return jsonError("ID preventivo mancante.");

    // Update an existing quote (port of quotes.php action=edit save).
    if (action === "update") {
      const quote = await updateDbQuote(id, {
        clientId: parseInteger(body.client_id, 0),
        clientName: body.client_name,
        discount: parseNumber(body.discount, 0),
        lines: quoteLinesFromBody(body),
      }, tenantSlug);
      return Response.json({ ok: true, source: "quotes?action=update", sourceMode: "database", quote, quotes: await listDbQuotes(tenantSlug) });
    }

    if (action === "send") {
      // Port of quotes.php action=email: email the quote to the client (public +
      // PDF links), then mark it sent. sendQuoteEmail is best-effort / SES-gated and
      // also performs the legacy "mark sent" stamp on a successful send; we still
      // flip the status first via updateDbQuoteStatus so the documented status
      // transition is preserved even when SES is unconfigured (unchanged behaviour).
      const quote = await updateDbQuoteStatus(id, "sent", tenantSlug);
      await sendQuoteEmail(id, tenantSlug, { toEmail: body.to_email, message: body.message });
      return Response.json({ ok: true, sourceMode: "database", quote, quotes: await listDbQuotes(tenantSlug) });
    }
    if (action === "accept") {
      const quote = await updateDbQuoteStatus(id, "accepted", tenantSlug);
      return Response.json({ ok: true, sourceMode: "database", quote, quotes: await listDbQuotes(tenantSlug) });
    }
    if (action === "convert") {
      const result = await convertDbQuoteToSale(id, tenantSlug, parseInteger(body.location_id, 0));
      return Response.json({ ok: true, source: "quotes?action=convert", sourceMode: "database", ...result, quotes: await listDbQuotes(tenantSlug) });
    }

    // Delete a draft quote (port of quotes.php action=delete).
    if (action === "delete") {
      await deleteDbQuote(tenantSlug, id);
      return Response.json({ ok: true, source: "quotes?action=delete", sourceMode: "database", quotes: await listDbQuotes(tenantSlug) });
    }

    return jsonError("Azione preventivi non supportata.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore preventivi.");
  }
}

function quoteLinesFromBody(body: Record<string, string>): PosSaleItemInput[] {
  if (body.lines_json) {
    try {
      const lines = JSON.parse(body.lines_json) as PosSaleItemInput[];
      if (Array.isArray(lines) && lines.length > 0) return lines;
    } catch {
      // fallback below
    }
  }

  return [{
    type: "service",
    refId: parseInteger(body.service_id, 0),
    name: body.service_name,
    quantity: parseNumber(body.quantity, 1),
    unitPrice: body.price ? parseNumber(body.price, 0) : undefined,
  }];
}
