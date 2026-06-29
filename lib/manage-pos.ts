import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import type {
  ManagedClient,
  ManagedProduct,
  ManagedService,
  PosCheckoutInput,
  PosPayment,
  PosPaymentInput,
  PosPaymentMethod,
  PosSale,
  PosSaleItem,
  PosSaleItemInput,
  PosSaleItemStatus,
  PosSaleItemType,
  PosSummary,
} from "@/lib/tenant-store";
import { previewDbCoupon } from "@/lib/db-repositories";
import { getManageLocationContext } from "@/lib/manage-locations";
import {
  columnExists,
  dbExecute,
  dbQuery,
  quoteIdentifier,
  tenantInsert,
  tenantSelect,
  tenantTable,
  tenantUpdate,
} from "@/lib/tenant-db";

type TenantTarget = Awaited<ReturnType<typeof tenantTable>>;

export type ManagePosContext = {
  ok: true;
  source: string;
  sourceMode: "database";
  activeLocationId: number;
  summary: PosSummary;
  sales: PosSale[];
  catalog: {
    clients: ManagedClient[];
    services: ManagedService[];
    products: ManagedProduct[];
  };
  locations: Array<{ id: number; name: string }>;
};

const sourceLabel = "app/pages/pos.php + app/pages/pos_history.php";

export async function getManagePosContext(
  slug: string,
  options: { locationId?: number; includeCancelled?: boolean; query?: string } = {},
): Promise<ManagePosContext> {
  const locationContext = await getManageLocationContext(slug);
  const activeLocationId = normalizeLocationId(options.locationId ?? locationContext.currentLocationId, locationContext.locations);
  const [sales, clients, services, products] = await Promise.all([
    listPosSales(slug, { locationId: activeLocationId, includeCancelled: options.includeCancelled ?? true, query: options.query ?? "" }),
    listPosClients(slug),
    listPosServices(slug, activeLocationId),
    listPosProducts(slug, activeLocationId),
  ]);

  return {
    ok: true,
    source: sourceLabel,
    sourceMode: "database",
    activeLocationId,
    summary: summarizeSales(sales),
    sales,
    catalog: { clients, services, products },
    locations: locationContext.locations.map((location) => ({ id: location.id, name: location.name })),
  };
}

export async function checkoutManageSale(
  slug: string,
  input: PosCheckoutInput,
  operator: { id: number | null; name: string },
): Promise<ManagePosContext & { sale: PosSale }> {
  const locationContext = await getManageLocationContext(slug);
  const locationId = normalizeLocationId(input.locationId ?? locationContext.currentLocationId, locationContext.locations);
  if (locationId <= 0) throw new Error("Seleziona una sede per la vendita.");
  if (!input.items.length) throw new Error("Carrello vuoto.");

  const client = await resolveSaleClient(slug, input.clientId ?? 0, input.clientName);
  const items = await buildSaleItems(slug, input.items, locationId, client.id > 0);
  if (!items.length) throw new Error("Aggiungi almeno un elemento prima di concludere la vendita.");

  const subtotal = roundMoney(items.reduce((total, item) => total + item.total, 0));
  const manualDiscount = roundMoney(Math.max(0, input.discount ?? 0));
  const couponCode = clean(input.couponCode, 40);
  let couponDiscount = 0;
  if (couponCode) {
    const coupon = await previewDbCoupon(couponCode, subtotal, slug);
    if (!coupon.valid) throw new Error(coupon.reason || "Coupon non valido.");
    couponDiscount = coupon.discount;
  }
  const discount = Math.min(subtotal, roundMoney(manualDiscount + couponDiscount));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const payments = normalizePayments(input.payments, total);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (paidAmount + 0.00001 < total) throw new Error("Pagamento insufficiente.");

  for (const item of items) {
    if (item.type === "product" && item.refId > 0 && item.status !== "ordered") {
      const available = await currentProductStock(slug, item.refId, locationId);
      if (available + 0.00001 < item.quantity) throw new Error(`Giacenza insufficiente per ${item.name}.`);
    }
  }

  const salesTable = await tenantTable(slug, "sales");
  const saleId = await tenantInsert(salesTable, await filterColumns(salesTable.name, {
    client_id: client.id > 0 ? client.id : null,
    sale_date: new Date(),
    subtotal,
    discount,
    total,
    coupon_code: emptyToNull(couponCode),
    notes: saleNotes(input.notes, input.appointmentId),
    status: "done",
    source_quote_id: undefined,
    created_by: operator.id,
    operator_name: clean(operator.name, 120),
    location_id: locationId,
    promotion_applied_id: input.promotionId && input.promotionId > 0 ? input.promotionId : null,
    credit_used: paymentAmount(payments, "wallet"),
    giftcard_used: paymentAmount(payments, "giftcard"),
  }));

  for (const item of items) {
    const saleItemId = await insertSaleItem(slug, saleId, item);
    if (item.type === "product" && item.refId > 0 && item.status !== "ordered") {
      await adjustProductStock(slug, item.refId, locationId, -item.quantity);
    }
    if (item.type === "prepaid" && client.id > 0) await issuePrepaidFromSale(slug, saleId, saleItemId, client.id, item);
    if (item.type === "package" && client.id > 0) await issuePackageFromSale(slug, saleId, client.id, item);
  }

  if (input.appointmentId && input.appointmentId > 0) {
    await tenantUpdate({ slug, table: "appointments", id: input.appointmentId, values: { status: "done" } }).catch(() => 0);
  }

  const sale = await getSale(slug, saleId);
  return {
    ...await getManagePosContext(slug, { locationId, includeCancelled: true }),
    sale,
  };
}

export async function cancelManageSale(
  slug: string,
  input: { saleId: number; reason: string; stockCancelMode: "restore" | "no_restore" | "none"; userId: number | null; userName: string },
): Promise<ManagePosContext & { sale: PosSale }> {
  if (input.saleId <= 0) throw new Error("Vendita non valida.");
  const saleRow = await getSaleRow(slug, input.saleId);
  if (isCancelledStatus(saleRow.status)) throw new Error("Vendita gia annullata.");
  const reason = clean(input.reason, 255);
  if (!reason) throw new Error("La motivazione e obbligatoria per annullare una vendita.");
  const sale = await mapSale(slug, saleRow);
  const locationId = Number(saleRow.location_id ?? sale.locationId ?? 0) || 0;
  const productItems = sale.items.filter((item) => item.type === "product" && item.refId > 0 && item.status !== "ordered");
  let stockMode = input.stockCancelMode;
  if (!productItems.length) stockMode = "none";
  if (productItems.length && !["restore", "no_restore"].includes(stockMode)) {
    throw new Error("Scegli come gestire il magazzino dei prodotti prima di confermare l'annullamento.");
  }

  for (const item of productItems) {
    const before = await currentProductStock(slug, item.refId, locationId);
    let after = before;
    if (stockMode === "restore") {
      await adjustProductStock(slug, item.refId, locationId, item.quantity);
      after = await currentProductStock(slug, item.refId, locationId);
    }
    await recordStockCancelAction(slug, {
      saleId: input.saleId,
      saleItemId: item.id,
      productId: item.refId,
      qty: item.quantity,
      action: stockMode === "restore" ? "restored" : "not_restored",
      stockBefore: before,
      stockAfter: after,
      locationId,
      note: stockMode === "restore" ? `Ripristino magazzino su annullamento vendita #${input.saleId}` : `Magazzino non ripristinato su annullamento vendita #${input.saleId}`,
      createdBy: input.userId,
    });
  }

  await markSaleCancelled(slug, input.saleId, {
    userId: input.userId,
    reason,
    note: cancelNote(input.saleId, input.userName, reason, stockMode, productItems),
  });
  await cancelLinkedSaleResidues(slug, input.saleId, reason);

  const updated = await getSale(slug, input.saleId);
  return {
    ...await getManagePosContext(slug, { locationId, includeCancelled: true }),
    sale: updated,
  };
}

async function listPosSales(slug: string, options: { locationId: number; includeCancelled: boolean; query: string }): Promise<PosSale[]> {
  const salesTable = await tenantTable(slug, "sales");
  const clientsTable = await tenantTable(slug, "clients").catch(() => null);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (salesTable.mode === "shared" && await columnExists(salesTable.name, "tenant_id")) {
    clauses.push("s.tenant_id=?");
    params.push(salesTable.tenantId ?? 0);
  }
  if (options.locationId > 0 && await columnExists(salesTable.name, "location_id")) {
    clauses.push("(s.location_id IS NULL OR s.location_id=?)");
    params.push(options.locationId);
  }
  if (!options.includeCancelled) clauses.push("LOWER(COALESCE(s.status,'')) NOT IN ('cancelled','canceled','annullata','annullato')");
  const query = clean(options.query, 120).toLowerCase();
  if (query) {
    clauses.push("(LOWER(COALESCE(c.full_name,'')) LIKE ? OR LOWER(COALESCE(s.notes,'')) LIKE ? OR CAST(s.id AS TEXT) LIKE ?)");
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const clientJoin = clientsTable
    ? `LEFT JOIN ${quoteIdentifier(clientsTable.name)} c ON c.id=s.client_id${clientsTable.mode === "shared" && await columnExists(clientsTable.name, "tenant_id") ? " AND c.tenant_id=s.tenant_id" : ""}`
    : "";
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT s.*, c.full_name AS client_name
       FROM ${quoteIdentifier(salesTable.name)} s
       ${clientJoin}
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY s.sale_date DESC, s.id DESC
      LIMIT 250`,
    params,
  );
  return Promise.all(rows.map((row) => mapSale(slug, row)));
}

async function listPosClients(slug: string): Promise<ManagedClient[]> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", orderBy: "full_name ASC, id ASC", limit: 500 }).catch(() => []);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.full_name ?? row.name ?? "Cliente"),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    lastVisit: "",
    value: "0 euro",
    next: "",
    note: String(row.notes ?? ""),
    locationId: Number(row.location_id ?? 0),
    tags: [],
    archived: Number(row.is_blocked ?? 0) === 1,
    createdAt: dateTimeString(row.created_at ?? row.registration_date),
    updatedAt: dateTimeString(row.updated_at),
  }));
}

async function listPosServices(slug: string, locationId: number): Promise<ManagedService[]> {
  const servicesTable = await tenantTable(slug, "services");
  const clauses = ["COALESCE(s.is_active,1)=1"];
  const params: unknown[] = [];
  if (servicesTable.mode === "shared" && await columnExists(servicesTable.name, "tenant_id")) {
    clauses.unshift("s.tenant_id=?");
    params.unshift(servicesTable.tenantId ?? 0);
  }
  const locationFilter = await serviceLocationFilter(slug, locationId);
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT s.*
       FROM ${quoteIdentifier(servicesTable.name)} s
      WHERE ${clauses.join(" AND ")}
        ${locationFilter.sql}
      ORDER BY COALESCE(s.sort_order,999999) ASC, s.name ASC, s.id ASC`,
    [...params, ...locationFilter.params],
  );
  const locationMap = await serviceLocationMap(slug, rows.map((row) => Number(row.id ?? 0)));
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Servizio"),
    duration: `${Number(row.duration_min ?? 60) || 60} min`,
    price: `${formatMoney(Number(row.price ?? 0) || 0)} euro`,
    category: "Servizi",
    demand: "",
    color: "#0f766e",
    description: "",
    locationIds: locationMap.get(Number(row.id ?? 0)) ?? [],
    active: Number(row.is_active ?? 1) === 1,
    bookingEnabled: Number(row.booking_enabled ?? 1) === 1,
    createdAt: dateTimeString(row.created_at),
    updatedAt: dateTimeString(row.updated_at),
  }));
}

async function listPosProducts(slug: string, locationId: number): Promise<ManagedProduct[]> {
  const productsTable = await tenantTable(slug, "products");
  const stockTable = locationId > 0 ? await tenantTable(slug, "product_stocks").catch(() => null) : null;
  const clauses = ["COALESCE(p.is_active,1)=1"];
  const params: unknown[] = [];
  const joinParams: unknown[] = [];
  if (productsTable.mode === "shared" && await columnExists(productsTable.name, "tenant_id")) {
    clauses.unshift("p.tenant_id=?");
    params.unshift(productsTable.tenantId ?? 0);
  }
  let stockJoin = "";
  let stockColumn = "p.stock";
  if (stockTable && locationId > 0) {
    const tenantJoin = stockTable.mode === "shared" && await columnExists(stockTable.name, "tenant_id") ? " AND ps.tenant_id=p.tenant_id" : "";
    stockJoin = `LEFT JOIN ${quoteIdentifier(stockTable.name)} ps ON ps.product_id=p.id AND ps.location_id=?${tenantJoin}`;
    joinParams.push(locationId);
    stockColumn = "COALESCE(ps.stock,p.stock)";
    clauses.push(`(COALESCE(ps.is_enabled,0)=1 OR NOT EXISTS(SELECT 1 FROM ${quoteIdentifier(stockTable.name)} ps_any WHERE ps_any.product_id=p.id${tenantJoin.replaceAll("ps.", "ps_any.")}))`);
  }
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT p.*, ${stockColumn} AS scoped_stock
       FROM ${quoteIdentifier(productsTable.name)} p
       ${stockJoin}
      WHERE ${clauses.join(" AND ")}
      ORDER BY COALESCE(p.category_id,999999) ASC, p.name ASC, p.id ASC`,
    [...joinParams, ...params],
  );
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: productDisplayName(String(row.name ?? "Prodotto"), String(row.sku ?? "")),
    category: "Prodotti",
    brand: String(row.brand ?? ""),
    price: `${formatMoney(Number(row.price ?? 0) || 0)} euro`,
    image: "",
    sku: String(row.sku ?? ""),
    stock: Number(row.scoped_stock ?? row.stock ?? 0) || 0,
    minStock: Number(row.min_stock ?? 0) || 0,
    locationId,
    publicVisible: Number(row.sell_online ?? 0) === 1,
    movements: [],
    createdAt: dateTimeString(row.created_at),
    updatedAt: dateTimeString(row.updated_at),
  }));
}

async function mapSale(slug: string, row: RowDataPacket): Promise<PosSale> {
  const id = Number(row.id ?? 0);
  const items = await saleItems(slug, id);
  const total = roundMoney(Number(row.total ?? 0) || 0);
  const payments = derivePayments(row, total);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  return {
    id,
    code: `S-${String(id).padStart(5, "0")}`,
    clientId: Number(row.client_id ?? 0) || 0,
    clientName: String(row.client_name ?? "") || await clientName(slug, Number(row.client_id ?? 0)),
    locationId: Number(row.location_id ?? 0) || 0,
    items,
    payments,
    subtotal: roundMoney(Number(row.subtotal ?? total) || 0),
    discount: roundMoney(Number(row.discount ?? 0) || 0),
    total,
    paidAmount,
    changeDue: roundMoney(Math.max(0, paidAmount - total)),
    status: isCancelledStatus(row.status) ? "cancelled" : "active",
    createdAt: dateTimeString(row.sale_date ?? row.created_at),
    cancelledAt: row.cancelled_at ? dateTimeString(row.cancelled_at) : undefined,
    cancelReason: row.cancelled_reason ? String(row.cancelled_reason) : undefined,
  };
}

async function saleItems(slug: string, saleId: number): Promise<PosSaleItem[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_items",
    where: "sale_id=?",
    params: [saleId],
    orderBy: "id ASC",
  }).catch(() => []);
  return rows.map((row) => {
    const type = normalizeStoredItemType(row.item_type);
    return {
      id: Number(row.id ?? 0),
      type,
      refId: Number(row.item_id ?? 0) || 0,
      name: String(row.item_name ?? "Voce"),
      quantity: Number(row.qty ?? 1) || 1,
      unitPrice: roundMoney(Number(row.unit_price ?? 0) || 0),
      total: roundMoney(Number(row.line_total ?? 0) || 0),
      status: normalizeItemStatus(type, row.item_status, true),
    };
  });
}

async function buildSaleItems(slug: string, inputItems: PosSaleItemInput[], locationId: number, hasClient: boolean): Promise<PosSaleItem[]> {
  const items: PosSaleItem[] = [];
  for (const [index, input] of inputItems.entries()) {
    const quantity = Math.max(1, Math.round(Number(input.quantity ?? 1) || 1));
    const refId = Number(input.refId ?? 0) || 0;
    if (input.type === "service") {
      const service = refId > 0 ? await serviceRow(slug, refId) : null;
      if (service && !await serviceAvailableAtLocation(slug, refId, locationId)) throw new Error("Servizio non disponibile nella sede selezionata.");
      const unitPrice = roundMoney(input.unitPrice ?? Number(service?.price ?? 0) ?? 0);
      items.push({
        id: index + 1,
        type: "service",
        refId: service ? Number(service.id) : refId,
        name: input.name?.trim() || String(service?.name ?? "Servizio"),
        quantity,
        unitPrice,
        total: roundMoney(unitPrice * quantity),
        status: normalizeItemStatus("service", input.status, hasClient),
      });
      continue;
    }
    if (input.type === "product") {
      const product = refId > 0 ? await productRow(slug, refId) : null;
      if (product && !await productAvailableAtLocation(slug, refId, locationId)) throw new Error("Prodotto non disponibile nella sede selezionata.");
      const unitPrice = roundMoney(input.unitPrice ?? Number(product?.price ?? 0) ?? 0);
      items.push({
        id: index + 1,
        type: "product",
        refId: product ? Number(product.id) : refId,
        name: input.name?.trim() || productDisplayName(String(product?.name ?? "Prodotto"), String(product?.sku ?? "")),
        quantity,
        unitPrice,
        total: roundMoney(unitPrice * quantity),
        status: normalizeItemStatus("product", input.status, hasClient),
      });
      continue;
    }

    const unitPrice = roundMoney(input.unitPrice ?? 0);
    items.push({
      id: index + 1,
      type: input.type,
      refId,
      name: input.name?.trim() || fallbackItemName(input.type),
      quantity,
      unitPrice,
      total: roundMoney(unitPrice * quantity),
      status: "prepaid",
    });
  }
  return items.filter((item) => item.quantity > 0);
}

async function insertSaleItem(slug: string, saleId: number, item: PosSaleItem): Promise<number> {
  const table = await tenantTable(slug, "sale_items");
  const storedType = item.type === "product" ? "product" : "service";
  return tenantInsert(table, await filterColumns(table.name, {
    sale_id: saleId,
    item_type: storedType,
    item_id: item.refId > 0 && (item.type === "product" || item.type === "service") ? item.refId : null,
    item_name: item.name,
    qty: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.total,
    item_status: item.status,
  }));
}

async function resolveSaleClient(slug: string, clientId: number, clientName?: string): Promise<{ id: number; name: string }> {
  if (clientId > 0) {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "id,full_name", where: "id=?", params: [clientId], limit: 1 });
    if (rows[0]) return { id: Number(rows[0].id ?? 0), name: String(rows[0].full_name ?? "Cliente") };
    throw new Error("Cliente non valido.");
  }
  const name = clean(clientName, 190) || "Cliente banco";
  if (name === "Cliente banco") return { id: 0, name };
  const table = await tenantTable(slug, "clients");
  const id = await tenantInsert(table, await filterColumns(table.name, {
    full_name: name,
    first_name: name.split(" ")[0] ?? name,
    last_name: name.split(" ").slice(1).join(" "),
    registration_date: todayIso(),
    points: 0,
    credit_balance: 0,
    is_blocked: 0,
  }));
  return { id, name };
}

async function serviceRow(slug: string, id: number): Promise<RowDataPacket | null> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "services", where: "id=? AND COALESCE(is_active,1)=1", params: [id], limit: 1 });
  return rows[0] ?? null;
}

async function productRow(slug: string, id: number): Promise<RowDataPacket | null> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "products", where: "id=? AND COALESCE(is_active,1)=1", params: [id], limit: 1 });
  return rows[0] ?? null;
}

async function getSale(slug: string, id: number): Promise<PosSale> {
  return mapSale(slug, await getSaleRow(slug, id));
}

async function getSaleRow(slug: string, id: number): Promise<RowDataPacket> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sales", where: "id=?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Vendita non trovata.");
  return rows[0];
}

async function serviceAvailableAtLocation(slug: string, serviceId: number, locationId: number): Promise<boolean> {
  if (serviceId <= 0 || locationId <= 0) return true;
  const table = await tenantTable(slug, "service_locations").catch(() => null);
  if (!table) return true;
  const scope = await tenantScope(table, ["service_id=?"], [serviceId]);
  const rows = await dbQuery<RowDataPacket[]>(`SELECT location_id FROM ${quoteIdentifier(table.name)}${scope.where}`, scope.params).catch(() => []);
  if (!rows.length) return true;
  return rows.some((row) => Number(row.location_id ?? 0) === locationId);
}

async function productAvailableAtLocation(slug: string, productId: number, locationId: number): Promise<boolean> {
  if (productId <= 0 || locationId <= 0) return true;
  const table = await tenantTable(slug, "product_stocks").catch(() => null);
  if (!table) return true;
  const scope = await tenantScope(table, ["product_id=?"], [productId]);
  const rows = await dbQuery<RowDataPacket[]>(`SELECT location_id,is_enabled FROM ${quoteIdentifier(table.name)}${scope.where}`, scope.params).catch(() => []);
  if (!rows.length) return true;
  return rows.some((row) => Number(row.location_id ?? 0) === locationId && Number(row.is_enabled ?? 1) === 1);
}

async function currentProductStock(slug: string, productId: number, locationId: number): Promise<number> {
  if (locationId > 0) {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "product_stocks", columns: "stock", where: "product_id=? AND location_id=?", params: [productId, locationId], limit: 1 }).catch(() => []);
    if (rows[0]) return Number(rows[0].stock ?? 0) || 0;
  }
  const row = await productRow(slug, productId);
  if (!row) throw new Error("Prodotto non trovato.");
  return Number(row.stock ?? 0) || 0;
}

async function adjustProductStock(slug: string, productId: number, locationId: number, delta: number): Promise<void> {
  const product = await productRow(slug, productId);
  if (!product) throw new Error("Prodotto non trovato.");
  const stocksTable = await tenantTable(slug, "product_stocks").catch(() => null);
  if (stocksTable && locationId > 0) {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "product_stocks", where: "product_id=? AND location_id=?", params: [productId, locationId], limit: 1 }).catch(() => []);
    if (!rows[0]) {
      await tenantInsert(stocksTable, await filterColumns(stocksTable.name, {
        product_id: productId,
        location_id: locationId,
        stock: Number(product.stock ?? 0) || 0,
        min_stock: Number(product.min_stock ?? 0) || 0,
        reorder_qty: Number(product.reorder_qty ?? 0) || 0,
        incoming_qty: Number(product.incoming_qty ?? 0) || 0,
        incoming_eta: product.incoming_eta ?? null,
        is_enabled: 1,
      }));
    }
    const current = await currentProductStock(slug, productId, locationId);
    const next = roundQuantity(current + delta);
    if (next < -0.00001) throw new Error(`Giacenza insufficiente per ${productDisplayName(String(product.name ?? "Prodotto"), String(product.sku ?? ""))}.`);
    await updateProductStockRow(slug, productId, locationId, { stock: Math.max(0, next), is_enabled: 1 });
    await refreshProductAggregateStock(slug, productId);
    return;
  }
  const next = roundQuantity((Number(product.stock ?? 0) || 0) + delta);
  if (next < -0.00001) throw new Error(`Giacenza insufficiente per ${productDisplayName(String(product.name ?? "Prodotto"), String(product.sku ?? ""))}.`);
  await tenantUpdate({ slug, table: "products", id: productId, values: { stock: Math.max(0, next) } });
}

async function updateProductStockRow(slug: string, productId: number, locationId: number, values: Record<string, unknown>): Promise<void> {
  const table = await tenantTable(slug, "product_stocks");
  const filtered = await filterColumns(table.name, values);
  const entries = Object.entries(filtered);
  if (!entries.length) return;
  const scope = await tenantScope(table, ["product_id=?", "location_id=?"], [productId, locationId]);
  await dbExecute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${entries.map(([key]) => `${quoteIdentifier(key)}=?`).join(",")} ${scope.where}`,
    [...entries.map(([, value]) => value), ...scope.params],
  );
}

async function refreshProductAggregateStock(slug: string, productId: number): Promise<void> {
  const table = await tenantTable(slug, "product_stocks").catch(() => null);
  if (!table) return;
  const scope = await tenantScope(table, ["product_id=?", "COALESCE(is_enabled,1)=1"], [productId]);
  const rows = await dbQuery<RowDataPacket[]>(`SELECT COALESCE(SUM(stock),0) AS stock FROM ${quoteIdentifier(table.name)}${scope.where}`, scope.params).catch(() => []);
  await tenantUpdate({ slug, table: "products", id: productId, values: { stock: Number(rows[0]?.stock ?? 0) || 0 } });
}

async function recordStockCancelAction(slug: string, input: { saleId: number; saleItemId: number; productId: number; qty: number; action: string; stockBefore: number; stockAfter: number; locationId: number; note: string; createdBy: number | null }): Promise<void> {
  const table = await tenantTable(slug, "pos_sale_stock_cancel_actions").catch(() => null);
  if (!table) return;
  await tenantInsert(table, await filterColumns(table.name, {
    sale_id: input.saleId,
    sale_item_id: input.saleItemId,
    product_id: input.productId,
    qty: input.qty,
    action: input.action,
    stock_before: input.stockBefore,
    stock_after: input.stockAfter,
    location_id: input.locationId || null,
    note: clean(input.note, 255),
    created_by: input.createdBy,
  })).catch(() => undefined);
}

async function markSaleCancelled(slug: string, saleId: number, input: { userId: number | null; reason: string; note: string }): Promise<void> {
  const table = await tenantTable(slug, "sales");
  await tenantUpdate({ slug, table: "sales", id: saleId, values: {
    status: "cancelled",
    cancelled_at: new Date(),
    cancelled_by: input.userId,
    cancelled_reason: input.reason,
  } });
  if (await columnExists(table.name, "notes")) {
    const scope = await tenantScope(table, ["id=?"], [saleId]);
    await dbExecute(`UPDATE ${quoteIdentifier(table.name)} SET notes=CONCAT(COALESCE(notes,''), ?)${scope.where}`, [`\n${input.note}`, ...scope.params]).catch(() => undefined);
  }
}

async function cancelLinkedSaleResidues(slug: string, saleId: number, reason: string): Promise<void> {
  await updateBySaleId(slug, "client_prepaid_services", saleId, { status: "cancelled", canceled_at: new Date(), cancel_note: reason });
  await updateBySaleId(slug, "client_packages", saleId, { status: "canceled", updated_at: new Date() });
  await updateBySaleId(slug, "sale_installment_plans", saleId, { status: "cancelled", cancelled_at: new Date(), cancelled_reason: reason });
  await updateBySaleId(slug, "sale_installments", saleId, { status: "cancelled", note: reason });
}

async function updateBySaleId(slug: string, tableName: string, saleId: number, values: Record<string, unknown>): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: tableName, columns: "id", where: "sale_id=?", params: [saleId] }).catch(() => []);
  for (const row of rows) {
    await tenantUpdate({ slug, table: tableName, id: Number(row.id ?? 0), values }).catch(() => 0);
  }
}

async function issuePrepaidFromSale(slug: string, saleId: number, saleItemId: number, clientId: number, item: PosSaleItem): Promise<void> {
  const table = await tenantTable(slug, "client_prepaid_services").catch(() => null);
  if (!table) return;
  await tenantInsert(table, await filterColumns(table.name, {
    client_id: clientId,
    sale_id: saleId,
    sale_item_id: saleItemId,
    service_id: item.refId > 0 ? item.refId : null,
    service_name: item.name,
    purchased_qty: item.quantity,
    remaining_qty: item.quantity,
    unit_price: item.unitPrice,
    total_paid: item.total,
    status: "active",
  })).catch(() => undefined);
}

async function issuePackageFromSale(slug: string, saleId: number, clientId: number, item: PosSaleItem): Promise<void> {
  const table = await tenantTable(slug, "client_packages").catch(() => null);
  if (!table) return;
  await tenantInsert(table, await filterColumns(table.name, {
    client_id: clientId,
    sale_id: saleId,
    package_id: item.refId > 0 ? item.refId : null,
    package_name: item.name,
    purchase_date: todayIso(),
    start_date: todayIso(),
    sessions_total: item.quantity,
    sessions_remaining: item.quantity,
    status: "active",
  })).catch(() => undefined);
}

async function clientName(slug: string, clientId: number): Promise<string> {
  if (clientId <= 0) return "Cliente banco";
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "full_name", where: "id=?", params: [clientId], limit: 1 }).catch(() => []);
  return String(rows[0]?.full_name ?? "Cliente");
}

async function serviceLocationFilter(slug: string, locationId: number): Promise<{ sql: string; params: unknown[] }> {
  if (locationId <= 0) return { sql: "", params: [] };
  const table = await tenantTable(slug, "service_locations").catch(() => null);
  if (!table) return { sql: "", params: [] };
  const tenantClause = table.mode === "shared" && await columnExists(table.name, "tenant_id") ? " AND sl.tenant_id=s.tenant_id" : "";
  return {
    sql: `AND (EXISTS(SELECT 1 FROM ${quoteIdentifier(table.name)} sl WHERE sl.service_id=s.id AND sl.location_id=?${tenantClause}) OR NOT EXISTS(SELECT 1 FROM ${quoteIdentifier(table.name)} sl_any WHERE sl_any.service_id=s.id${tenantClause.replaceAll("sl.", "sl_any.")}))`,
    params: [locationId],
  };
}

async function serviceLocationMap(slug: string, serviceIds: number[]): Promise<Map<number, number[]>> {
  const ids = serviceIds.filter((id) => id > 0);
  const map = new Map<number, number[]>();
  if (!ids.length) return map;
  const table = await tenantTable(slug, "service_locations").catch(() => null);
  if (!table) return map;
  const scope = await tenantScope(table, [`service_id IN (${ids.map(() => "?").join(",")})`], ids);
  const rows = await dbQuery<RowDataPacket[]>(`SELECT service_id, location_id FROM ${quoteIdentifier(table.name)}${scope.where}`, scope.params).catch(() => []);
  for (const row of rows) {
    const serviceId = Number(row.service_id ?? 0);
    const locationId = Number(row.location_id ?? 0);
    if (serviceId <= 0 || locationId <= 0) continue;
    const list = map.get(serviceId) ?? [];
    list.push(locationId);
    map.set(serviceId, list);
  }
  return map;
}

function summarizeSales(sales: PosSale[]): PosSummary {
  const activeSales = sales.filter((sale) => sale.status !== "cancelled");
  const cancelledSales = sales.filter((sale) => sale.status === "cancelled");
  const paymentTotals: Record<PosPaymentMethod, number> = { cash: 0, card: 0, transfer: 0, giftcard: 0, wallet: 0 };
  let serviceTotal = 0;
  let productTotal = 0;
  for (const sale of activeSales) {
    for (const payment of sale.payments) paymentTotals[payment.method] = roundMoney(paymentTotals[payment.method] + payment.amount);
    for (const item of sale.items) {
      if (item.type === "service") serviceTotal = roundMoney(serviceTotal + item.total);
      if (item.type === "product") productTotal = roundMoney(productTotal + item.total);
    }
  }
  return {
    saleCount: activeSales.length,
    grossTotal: roundMoney(sales.reduce((sum, sale) => sum + sale.total, 0)),
    activeTotal: roundMoney(activeSales.reduce((sum, sale) => sum + sale.total, 0)),
    cancelledTotal: roundMoney(cancelledSales.reduce((sum, sale) => sum + sale.total, 0)),
    paymentTotals,
    serviceTotal,
    productTotal,
  };
}

function derivePayments(row: RowDataPacket, total: number): PosPayment[] {
  const wallet = roundMoney(Number(row.credit_used ?? 0) || 0);
  const giftcard = roundMoney(Number(row.giftcard_used ?? 0) || 0);
  const card = roundMoney(Math.max(0, total - wallet - giftcard));
  const payments: PosPayment[] = [];
  let id = 1;
  if (wallet > 0) payments.push({ id: id++, method: "wallet", amount: wallet });
  if (giftcard > 0) payments.push({ id: id++, method: "giftcard", amount: giftcard });
  if (card > 0 || !payments.length) payments.push({ id, method: "card", amount: card || total });
  return payments;
}

function normalizePayments(payments: PosPaymentInput[], total: number): PosPayment[] {
  const out = payments
    .map((payment, index) => ({ id: index + 1, method: normalizePaymentMethod(payment.method), amount: roundMoney(Math.max(0, Number(payment.amount ?? 0) || 0)) }))
    .filter((payment) => payment.amount > 0);
  if (!out.length && total > 0) return [{ id: 1, method: "card", amount: total }];
  return out;
}

function paymentAmount(payments: PosPayment[], method: PosPaymentMethod): number {
  return roundMoney(payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.amount, 0));
}

async function filterColumns(table: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(values).map(async ([key, value]) => [key, value, await columnExists(table, key)] as const),
  );
  return Object.fromEntries(entries.filter(([, value, exists]) => exists && value !== undefined).map(([key, value]) => [key, value]));
}

async function tenantScope(target: TenantTarget, clauses: string[], params: unknown[]) {
  const scopedClauses = [...clauses];
  const scopedParams = [...params];
  if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
    scopedClauses.unshift("tenant_id=?");
    scopedParams.unshift(target.tenantId ?? 0);
  }
  return { where: scopedClauses.length ? ` WHERE ${scopedClauses.join(" AND ")}` : "", params: scopedParams };
}

function normalizeLocationId(value: number, locations: Array<{ id: number }>): number {
  if (value > 0 && locations.some((location) => location.id === value)) return value;
  return locations.length === 1 ? locations[0]?.id ?? 0 : locations[0]?.id ?? 0;
}

function normalizePaymentMethod(value: unknown): PosPaymentMethod {
  const method = String(value ?? "").toLowerCase();
  if (method === "cash" || method === "card" || method === "transfer" || method === "giftcard" || method === "wallet") return method;
  return "card";
}

function normalizeStoredItemType(value: unknown): PosSaleItemType {
  const type = String(value ?? "").toLowerCase();
  if (type === "product") return "product";
  if (type === "giftcard") return "giftcard";
  if (type === "prepaid") return "prepaid";
  if (type === "package") return "package";
  if (type === "giftbox") return "giftbox";
  return "service";
}

function normalizeItemStatus(type: PosSaleItemType, value: unknown, hasClient: boolean): PosSaleItemStatus {
  const status = String(value ?? "").toLowerCase();
  if (type === "product") {
    if (status === "ordered" || status === "ordinato") return "ordered";
    return "collected";
  }
  if (type === "service") {
    if (status === "executed" || status === "done" || status === "eseguito") return "executed";
    if (status === "prepaid" || status === "prepagato") return "prepaid";
    return hasClient ? "prepaid" : "executed";
  }
  return "prepaid";
}

function isCancelledStatus(value: unknown): boolean {
  return ["cancelled", "canceled", "annullata", "annullato"].includes(String(value ?? "").toLowerCase());
}

function cancelNote(saleId: number, userName: string, reason: string, stockMode: string, items: PosSaleItem[]): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines = [`[ANNULLATA ${now}] Vendita #${saleId} annullata dall'operatore ${userName || "Operatore"}.`, `Motivo: ${reason}.`];
  if (items.length) {
    const qty = items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(stockMode === "restore" ? `Magazzino prodotti ripristinato: ${qty} pezzi.` : `Magazzino prodotti non ripristinato: ${qty} pezzi.`);
  }
  return lines.join("\n");
}

function fallbackItemName(type: PosSaleItemType): string {
  if (type === "giftcard") return "GiftCard";
  if (type === "package") return "Pacchetto";
  if (type === "giftbox") return "GiftBox";
  if (type === "prepaid") return "Prepagato";
  return "Voce";
}

function productDisplayName(name: string, sku: string): string {
  return sku ? `${name} (${sku})` : name;
}

function emptyToNull(value: unknown): string | null {
  const text = clean(value, 255);
  return text || null;
}

function saleNotes(notes: unknown, appointmentId?: number): string | null {
  const lines = [];
  const text = clean(notes, 2000);
  if (text) lines.push(text);
  if (appointmentId && appointmentId > 0) lines.push(`Appuntamento #${appointmentId}`);
  return lines.length ? lines.join("\n") : null;
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function formatMoney(value: number): string {
  return roundMoney(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateTimeString(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
