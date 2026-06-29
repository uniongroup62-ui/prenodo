import { jsonError, parseInteger, parseNumber, parseRequestBody } from "@/lib/api-utils";
import { convertDbQuoteToSale, createDbQuote, listDbQuotes, updateDbQuoteStatus } from "@/lib/db-repositories";
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
    return Response.json({
      ok: true,
      source: "app/pages/quotes.php",
      sourceMode: "database",
      quotes: await listDbQuotes(tenantSlug),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore preventivi.");
  }
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

    if (action === "send") {
      const quote = await updateDbQuoteStatus(id, "sent", tenantSlug);
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
