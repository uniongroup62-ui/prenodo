import { jsonError, parseInteger, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import {
  cancelStockDocument,
  deleteProduct,
  deleteProductCategory,
  deleteSupplier,
  getManageProduct,
  getManageProductsContext,
  saveProduct,
  saveProductCategory,
  saveStockMovement,
  saveSupplier,
} from "@/lib/manage-products";
import { can, canAny } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);
  if (!canAny(session.user.perms, ["products.manage", "product_categories.manage", "stock_moves.manage", "suppliers.manage"])) {
    return jsonError("Permesso negato.", 403);
  }

  try {
    const url = new URL(request.url);

    // Edit-form prefill: return ONE product's editable fields for one id. Port of
    // products.php action=edit. Gated by products.manage like the save action.
    if (url.searchParams.get("action") === "get") {
      if (!can(session.user.perms, "products.manage")) return jsonError("Permesso Magazzino richiesto.", 403);
      const productId = parseInteger(url.searchParams.get("id"), 0);
      if (productId <= 0) return jsonError("ID prodotto mancante.");
      const product = await getManageProduct(tenantSlug, productId);
      if (!product) return jsonError("Prodotto non trovato.", 404);
      return Response.json({ ok: true, source: "products?action=get", sourceMode: "database", product });
    }

    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: url.searchParams.get("location_id"),
      fallbackCurrent: true,
    });
    return Response.json(await getManageProductsContext(tenantSlug, {
      query: url.searchParams.get("q") ?? "",
      locationId,
      includeInactive: ["1", "true", "yes", "all"].includes((url.searchParams.get("include_inactive") ?? "1").toLowerCase()),
    }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Magazzino non caricato.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  try {
    const body = await parseRequestBody(request);
    const url = new URL(request.url);
    const action = String(body.action ?? url.searchParams.get("action") ?? "create");

    switch (action) {
      case "create":
      case "new":
      case "save":
      case "update":
      case "edit":
      case "product_save":
        if (!can(session.user.perms, "products.manage")) return jsonError("Permesso Magazzino richiesto.", 403);
        return Response.json(await saveProduct(tenantSlug, body));

      case "delete":
      case "product_delete":
        if (!can(session.user.perms, "products.manage")) return jsonError("Permesso Magazzino richiesto.", 403);
        return Response.json(await deleteProduct(tenantSlug, parseInteger(body.id ?? body.product_id, 0)));

      case "category_save":
      case "product_category_save":
      case "categories":
        if (!can(session.user.perms, "product_categories.manage")) return jsonError("Permesso Categorie prodotti richiesto.", 403);
        return Response.json(await saveProductCategory(tenantSlug, body));

      case "category_delete":
      case "product_category_delete":
        if (!can(session.user.perms, "product_categories.manage")) return jsonError("Permesso Categorie prodotti richiesto.", 403);
        return Response.json(await deleteProductCategory(tenantSlug, parseInteger(body.id ?? body.cat_id ?? body.category_id, 0)));

      case "move_stock":
      case "stock_move_save":
      case "stock_doc_save":
        if (!can(session.user.perms, "stock_moves.manage")) return jsonError("Permesso Carico / Scarico richiesto.", 403);
        return Response.json(await saveStockMovement(tenantSlug, body, session.user.name, session.user.id));

      case "stock_doc_cancel":
      case "stock_move_cancel":
        if (!can(session.user.perms, "stock_moves.manage")) return jsonError("Permesso Carico / Scarico richiesto.", 403);
        return Response.json(await cancelStockDocument(tenantSlug, parseInteger(body.id ?? body.stock_doc_id, 0), session.user.name, session.user.id));

      case "supplier_save":
        if (!can(session.user.perms, "suppliers.manage")) return jsonError("Permesso Fornitori richiesto.", 403);
        return Response.json(await saveSupplier(tenantSlug, body));

      case "supplier_delete":
        if (!can(session.user.perms, "suppliers.manage")) return jsonError("Permesso Fornitori richiesto.", 403);
        return Response.json(await deleteSupplier(tenantSlug, parseInteger(body.id ?? body.supplier_id, 0)));

      default:
        return jsonError("Azione magazzino non supportata.", 400);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Operazione magazzino non riuscita.");
  }
}
