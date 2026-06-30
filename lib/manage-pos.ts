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
import {
  addDbWalletMovement,
  dbClientGiftcards,
  dbWalletBalance,
  previewDbCoupon,
  redeemDbGiftCard,
  refundDbGiftCard,
} from "@/lib/db-repositories";
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

// The "Residui" the POS can spend on a sale for a selected client: their wallet CREDIT
// balance (clients.credit_balance, the same source Quick Booking + the wallet ledger
// use) and each available (active, non-expired, balance > 0) GiftCard the client owns.
// Port of pos_payment_residual_credit_data + the credit_wallet_balance/active_card
// helpers (app/pages/pos.php), reusing the existing repo readers so the numbers match
// what the rest of the app shows. Returns zeros / empty for "Cliente banco" (id <= 0).
export type ManagePosResiduals = {
  ok: true;
  clientId: number;
  credit: number;
  giftcards: Array<{ id: number; code: string; balance: number }>;
  // FIDELITY redemption: the client's spendable POINTS balance (clients.points) plus the
  // business redeem settings, so the UI can render the "punti da usare" box and compute the
  // resulting € discount (points x euroPerPoint). `enabled` mirrors the legacy gate:
  // fidelity_enabled AND fidelity_redeem_enabled AND the client actually has points.
  points: number;
  fidelity: {
    enabled: boolean;
    euroPerPoint: number;
    minPoints: number;
  };
};

export async function getManagePosResiduals(slug: string, clientId: number): Promise<ManagePosResiduals> {
  const id = Math.max(0, Number(clientId) || 0);
  const settings = await getFidelityRedeemSettings(slug);
  if (id <= 0) {
    return { ok: true, clientId: 0, credit: 0, giftcards: [], points: 0, fidelity: { enabled: false, euroPerPoint: settings.euroPerPoint, minPoints: settings.minPoints } };
  }
  const [{ credit, points }, giftcards] = await Promise.all([
    dbWalletBalance(id, slug).catch(() => ({ credit: 0, points: 0 })),
    dbClientGiftcards(slug, id).catch(() => []),
  ]);
  const normalizedPoints = normalizePoints(points);
  return {
    ok: true,
    clientId: id,
    credit: roundMoney(Math.max(0, credit)),
    giftcards: giftcards.map((card) => ({ id: card.id, code: card.code, balance: roundMoney(Math.max(0, card.balance)) })),
    points: normalizedPoints,
    // Redemption is offered only when globally enabled AND the client has points to spend
    // (faithful to pos.php: `$client_id && $fid['enabled'] && $fid['redeem_enabled']`).
    fidelity: {
      enabled: settings.redeemEnabled && normalizedPoints > 0,
      euroPerPoint: settings.euroPerPoint,
      minPoints: settings.minPoints,
    },
  };
}

// Port of Fidelity::settings() redeem block (app/lib/Fidelity.php ~610-620): read the
// fidelity redeem config off the single `businesses` row, with the legacy defaults +
// clamps. euroPerPoint defaults to 0.10, must be > 0 and <= 100000; minPoints defaults to
// 0, clamped to [0, 100000000] and floored to an integer (points are always whole).
// Schema-guarded: if the install lacks the columns, falls back to the defaults so the
// flow still works (euroPerPoint=0.10, minPoints=0) while staying disabled by default.
type FidelityRedeemSettings = { redeemEnabled: boolean; euroPerPoint: number; minPoints: number };

async function getFidelityRedeemSettings(slug: string): Promise<FidelityRedeemSettings> {
  const defaults: FidelityRedeemSettings = { redeemEnabled: false, euroPerPoint: 0.1, minPoints: 0 };
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "businesses",
      columns: "fidelity_enabled,fidelity_redeem_enabled,fidelity_redeem_euro_per_point,fidelity_redeem_min_points",
      orderBy: "id ASC",
      limit: 1,
    });
    const row = rows[0];
    if (!row) return defaults;
    const enabled = Number(row.fidelity_enabled ?? 0) === 1 && Number(row.fidelity_redeem_enabled ?? 0) === 1;
    let euroPerPoint = Number(row.fidelity_redeem_euro_per_point ?? 0.1);
    if (!Number.isFinite(euroPerPoint) || euroPerPoint <= 0) euroPerPoint = 0.1;
    if (euroPerPoint > 100000) euroPerPoint = 100000;
    let minPoints = Number(row.fidelity_redeem_min_points ?? 0);
    if (!Number.isFinite(minPoints) || minPoints < 0) minPoints = 0;
    if (minPoints > 100000000) minPoints = 100000000;
    minPoints = normalizePoints(minPoints);
    return { redeemEnabled: enabled, euroPerPoint: roundMoney(euroPerPoint), minPoints };
  } catch {
    return defaults;
  }
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
  // FIDELITY points redemption: convert the requested points into an euro discount,
  // capped by the client balance + the amount still payable after manual + coupon. The
  // points discount is ADDED to the sale discount (so the total drops) and the points are
  // consumed below, linked to the sale id. Mirrors pos.php: discount += fid_discount.
  const baseForPoints = roundMoney(Math.max(0, subtotal - manualDiscount - couponDiscount));
  const redemption = await resolveFidelityRedemption(slug, client.id, input.fidelityPointsUse ?? 0, baseForPoints);
  const discount = Math.min(subtotal, roundMoney(manualDiscount + couponDiscount + redemption.discount));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const payments = normalizePayments(input.payments, total);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (paidAmount + 0.00001 < total) throw new Error("Pagamento insufficiente.");

  // Residui: validate the wallet CREDIT + GiftCard tenders against the client's real
  // balances BEFORE writing anything. The base method (cash/card/transfer) covers the
  // remainder. Faithful to pos.php: giftcard_used = min(giftcardBalance, total, req),
  // credit_used = min(walletBalance, total - giftcard_used, req). Residui require a
  // real client (id > 0); a bench sale ("Cliente banco") cannot spend residui.
  const residui = await resolveResiduiTenders(slug, payments, client.id, total);

  for (const item of items) {
    if (item.type === "product" && item.refId > 0 && item.status !== "ordered") {
      const available = await currentProductStock(slug, item.refId, locationId);
      if (available + 0.00001 < item.quantity) throw new Error(`Giacenza insufficiente per ${item.name}.`);
    }
  }

  const baseMethod = resolveBaseMethod(payments);
  const salesTable = await tenantTable(slug, "sales");
  const saleId = await tenantInsert(salesTable, await filterColumns(salesTable.name, {
    client_id: client.id > 0 ? client.id : null,
    sale_date: new Date(),
    subtotal,
    discount,
    total,
    coupon_code: emptyToNull(couponCode),
    notes: saleNotes(input.notes, input.appointmentId, baseMethod),
    status: "done",
    source_quote_id: undefined,
    created_by: operator.id,
    operator_name: clean(operator.name, 120),
    location_id: locationId,
    promotion_applied_id: input.promotionId && input.promotionId > 0 ? input.promotionId : null,
    credit_used: residui.creditUsed,
    giftcard_id: residui.giftcardId > 0 ? residui.giftcardId : null,
    giftcard_used: residui.giftcardUsed,
    // Persist the FIDELITY points spent + their euro discount (sales.fidelity_points_used /
    // sales.fidelity_discount), so a later void can refund them. Schema-guarded.
    fidelity_points_used: redemption.pointsUsed,
    fidelity_discount: redemption.discount,
    // Persist the faithful base payment method. Schema-guarded: a no-op on installs
    // without the column (the notes marker keeps derivePayments correct regardless).
    payment_methods: JSON.stringify({ base: baseMethod }),
  }));

  // CONSUME the residui, linking each consumption to the sale id so a later void can
  // restore it (cancelLinkedSaleResidues reverses both). GiftCard first, then credit.
  if (residui.giftcardId > 0 && residui.giftcardUsed > 0) {
    await redeemDbGiftCard(residui.giftcardId, residui.giftcardUsed, slug);
  }
  if (residui.creditUsed > 0 && client.id > 0) {
    // Negative wallet movement (debit): inserts a credit_adjustments row + decrements
    // clients.credit_balance (the same path the legacy credit_wallet_adjust uses).
    await addDbWalletMovement(
      { clientId: client.id, type: "debit", amount: -residui.creditUsed, note: `Credito utilizzato vendita #${saleId}` },
      slug,
    );
  }
  // CONSUME the redeemed FIDELITY points: a negative points_redeem movement inserts a
  // transactions row (kind=redeem, source_type=sale) + decrements clients.points — the
  // points analog of the credit consume. Linked to the sale id for the void refund below.
  if (redemption.pointsUsed > 0 && client.id > 0) {
    await addDbWalletMovement(
      {
        clientId: client.id,
        type: "points_redeem",
        points: -redemption.pointsUsed,
        source: "sale",
        note: `Sconto Fidelity vendita #${saleId}`,
      },
      slug,
    );
  }

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
  await cancelLinkedSaleResidues(slug, input.saleId, reason, saleRow);

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

async function cancelLinkedSaleResidues(slug: string, saleId: number, reason: string, saleRow?: RowDataPacket): Promise<void> {
  await updateBySaleId(slug, "client_prepaid_services", saleId, { status: "cancelled", canceled_at: new Date(), cancel_note: reason });
  await updateBySaleId(slug, "client_packages", saleId, { status: "canceled", updated_at: new Date() });
  await updateBySaleId(slug, "sale_installment_plans", saleId, { status: "cancelled", cancelled_at: new Date(), cancelled_reason: reason });
  await updateBySaleId(slug, "sale_installments", saleId, { status: "cancelled", note: reason });

  // Restore the residui consumed at checkout: refund the GiftCard balance (re-activating
  // a card the redeem flipped to 'redeemed') and credit the wallet back. Both are linked
  // by the sale row's credit_used / giftcard_id / giftcard_used columns. Best-effort and
  // idempotency-guarded: zero the columns so a re-void cannot double-refund.
  if (!saleRow) return;
  const creditUsed = roundMoney(Number(saleRow.credit_used ?? 0) || 0);
  const giftcardUsed = roundMoney(Number(saleRow.giftcard_used ?? 0) || 0);
  const giftcardId = Math.max(0, Number(saleRow.giftcard_id ?? 0) || 0);
  const clientId = Math.max(0, Number(saleRow.client_id ?? 0) || 0);
  const pointsUsed = normalizePoints(Number(saleRow.fidelity_points_used ?? 0) || 0);

  if (giftcardId > 0 && giftcardUsed > 0) {
    await refundDbGiftCard(giftcardId, giftcardUsed, slug, `Storno vendita #${saleId}`).catch(() => undefined);
  }
  if (creditUsed > 0 && clientId > 0) {
    await addDbWalletMovement(
      { clientId, type: "recharge", amount: creditUsed, note: `Storno credito vendita #${saleId}` },
      slug,
    ).catch(() => undefined);
  }
  // REFUND the redeemed FIDELITY points: a positive points_earn movement re-credits
  // clients.points (the inverse of the points_redeem consumed at checkout), mirroring the
  // legacy `Fidelity::addTransaction(clientId, +ptsUsed, ...)` on sale cancel.
  if (pointsUsed > 0 && clientId > 0) {
    await addDbWalletMovement(
      { clientId, type: "points_earn", points: pointsUsed, source: "sale", note: `Storno punti Fidelity vendita #${saleId}` },
      slug,
    ).catch(() => undefined);
  }
  const salesTableName = (await tenantTable(slug, "sales")).name;
  if ((creditUsed > 0 || giftcardUsed > 0) && (await columnExists(salesTableName, "credit_used"))) {
    await tenantUpdate({ slug, table: "sales", id: saleId, values: { credit_used: 0, giftcard_used: 0 } }).catch(() => 0);
  }
  // Zero the stored points so a re-void cannot double-refund (idempotency guard, like the
  // credit_used/giftcard_used reset above).
  if (pointsUsed > 0 && (await columnExists(salesTableName, "fidelity_points_used"))) {
    await tenantUpdate({ slug, table: "sales", id: saleId, values: { fidelity_points_used: 0, fidelity_discount: 0 } }).catch(() => 0);
  }
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

// Reconstruct the tenders from the stored sale row: the residui from credit_used /
// giftcard_used (+ the linked giftcard_id), and the remainder as the persisted base
// method (cash/card/transfer) — read back faithfully instead of always "card".
function derivePayments(row: RowDataPacket, total: number): PosPayment[] {
  const wallet = roundMoney(Number(row.credit_used ?? 0) || 0);
  const giftcard = roundMoney(Number(row.giftcard_used ?? 0) || 0);
  const giftcardId = Math.max(0, Number(row.giftcard_id ?? 0) || 0);
  const base = roundMoney(Math.max(0, total - wallet - giftcard));
  const baseMethod = readStoredBaseMethod(row);
  const payments: PosPayment[] = [];
  let id = 1;
  if (wallet > 0) payments.push({ id: id++, method: "wallet", amount: wallet });
  if (giftcard > 0) payments.push({ id: id++, method: "giftcard", amount: giftcard, giftcardId: giftcardId > 0 ? giftcardId : undefined });
  if (base > 0 || !payments.length) payments.push({ id, method: baseMethod, amount: base || total });
  return payments;
}

function normalizePayments(payments: PosPaymentInput[], total: number): PosPayment[] {
  const out = payments
    .map((payment, index) => ({
      id: index + 1,
      method: normalizePaymentMethod(payment.method),
      amount: roundMoney(Math.max(0, Number(payment.amount ?? 0) || 0)),
      giftcardId: Math.max(0, Number(payment.giftcardId ?? 0) || 0) || undefined,
    }))
    .filter((payment) => payment.amount > 0);
  if (!out.length && total > 0) return [{ id: 1, method: "card", amount: total }];
  return out;
}

function paymentAmount(payments: PosPayment[], method: PosPaymentMethod): number {
  return roundMoney(payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.amount, 0));
}

// The faithful single base payment method (Contanti/Carta/Assegno/Bonifico) that covers
// the remainder after residui. The wallet/giftcard tenders are residui, NOT the base
// method, so they are excluded here; the first non-residual tender wins, defaulting to
// "card" (mirrors the legacy single payment_type radio).
function resolveBaseMethod(payments: PosPayment[]): PosPaymentMethod {
  const base = payments.find((payment) => payment.method !== "wallet" && payment.method !== "giftcard");
  return base ? base.method : "card";
}

type ResiduiTenders = { creditUsed: number; giftcardId: number; giftcardUsed: number };

// Validate + clamp the residui tenders (wallet CREDIT + one GiftCard) against the
// client's real balances and the sale total. Throws on an over-spend so the checkout
// fails cleanly BEFORE any row is written. Returns the amounts actually consumable.
async function resolveResiduiTenders(
  slug: string,
  payments: PosPayment[],
  clientId: number,
  total: number,
): Promise<ResiduiTenders> {
  const creditReq = paymentAmount(payments, "wallet");
  const giftcardReq = paymentAmount(payments, "giftcard");
  if (creditReq <= 0 && giftcardReq <= 0) return { creditUsed: 0, giftcardId: 0, giftcardUsed: 0 };
  if (clientId <= 0) throw new Error("Seleziona un cliente per usare credito o GiftCard.");

  // GiftCard first (legacy order): the picked card's id rides on the giftcard tender.
  let giftcardId = 0;
  let giftcardUsed = 0;
  if (giftcardReq > 0) {
    const tender = payments.find((payment) => payment.method === "giftcard" && payment.amount > 0);
    giftcardId = Math.max(0, Number(tender?.giftcardId ?? 0) || 0);
    if (giftcardId <= 0) throw new Error("Seleziona la GiftCard da utilizzare.");
    const available = (await dbClientGiftcards(slug, clientId)).find((card) => card.id === giftcardId);
    if (!available) throw new Error("La GiftCard selezionata non è disponibile per il cliente.");
    giftcardUsed = roundMoney(Math.min(giftcardReq, available.balance, total));
    if (giftcardUsed + 0.00001 < giftcardReq) throw new Error("Saldo GiftCard insufficiente.");
  }

  // Credit covers what is left of the total after the giftcard.
  let creditUsed = 0;
  if (creditReq > 0) {
    const { credit } = await dbWalletBalance(clientId, slug);
    const remaining = roundMoney(Math.max(0, total - giftcardUsed));
    creditUsed = roundMoney(Math.min(creditReq, Math.max(0, credit), remaining));
    if (creditUsed + 0.00001 < creditReq) throw new Error("Credito disponibile insufficiente.");
  }

  return { creditUsed, giftcardId, giftcardUsed };
}

type FidelityRedemption = { pointsUsed: number; discount: number };

// Validate + convert a FIDELITY points redemption request into an euro discount, faithful
// to pos.php (~4517-4566) + Fidelity::normalizeRedeem. Points are whole; the discount is
// pointsUsed x euroPerPoint, capped by the client's balance AND by `baseAmount` (what is
// still payable after the manual + coupon discount). Throws cleanly on an over-spend /
// below-minimum BEFORE any row is written. Returns {0,0} when no redemption is requested
// or redemption is disabled.
async function resolveFidelityRedemption(
  slug: string,
  clientId: number,
  requestedPointsUse: number,
  baseAmount: number,
): Promise<FidelityRedemption> {
  const requested = normalizePoints(Math.max(0, Number(requestedPointsUse) || 0));
  if (requested <= 0) return { pointsUsed: 0, discount: 0 };

  const settings = await getFidelityRedeemSettings(slug);
  if (!settings.redeemEnabled) throw new Error("Sconto punti non abilitato.");
  if (clientId <= 0) throw new Error("Seleziona un cliente per usare i punti.");

  const { points } = await dbWalletBalance(clientId, slug);
  const available = normalizePoints(Math.max(0, points));
  if (available <= 0) throw new Error("Punti non disponibili.");
  if (requested > available) throw new Error("Punti insufficienti.");
  if (settings.minPoints > 0 && requested < settings.minPoints) {
    throw new Error(`Minimo punti utilizzabile: ${settings.minPoints}.`);
  }
  if (baseAmount <= 0.00001) throw new Error("Importo insufficiente per applicare lo sconto punti.");

  // Cap the points used by the payable amount (whole points only), then derive the euro
  // discount and hard-clamp it to baseAmount (legacy normalizeRedeem).
  const maxByAmount = normalizePoints(baseAmount / settings.euroPerPoint);
  let pointsUsed = Math.min(requested, available, maxByAmount);
  if (pointsUsed <= 0) return { pointsUsed: 0, discount: 0 };
  if (settings.minPoints > 0 && pointsUsed < settings.minPoints) {
    throw new Error("Con l'importo attuale non puoi usare il minimo punti richiesto.");
  }
  let discount = roundMoney(pointsUsed * settings.euroPerPoint);
  if (discount > baseAmount + 0.000001) {
    discount = roundMoney(baseAmount);
    pointsUsed = normalizePoints(discount / settings.euroPerPoint);
    discount = roundMoney(pointsUsed * settings.euroPerPoint);
  }
  if (pointsUsed <= 0 || discount <= 0) return { pointsUsed: 0, discount: 0 };
  return { pointsUsed, discount };
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

// Marker appended to sales.notes so the base payment method survives even on installs
// whose sales table has no payment_methods column (derivePayments parses it back). The
// legacy POS likewise records the payment type as a notes line ("Tipo pagamento: ...").
const BASE_METHOD_MARKER = "[posmethod:";

function saleNotes(notes: unknown, appointmentId?: number, baseMethod?: PosPaymentMethod): string | null {
  const lines = [];
  const text = clean(notes, 2000);
  if (text) lines.push(text);
  if (appointmentId && appointmentId > 0) lines.push(`Appuntamento #${appointmentId}`);
  if (baseMethod) lines.push(`${BASE_METHOD_MARKER}${baseMethod}]`);
  return lines.length ? lines.join("\n") : null;
}

// Recover the persisted base payment method: prefer the structured payment_methods JSON
// (when the column exists), else the notes marker, defaulting to "card".
function readStoredBaseMethod(row: RowDataPacket): PosPaymentMethod {
  const raw = row.payment_methods;
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const base = normalizePaymentMethod((parsed as { base?: unknown })?.base);
      if (base === "cash" || base === "card" || base === "transfer") return base;
    } catch {
      // fall through to the notes marker
    }
  }
  const notes = String(row.notes ?? "");
  const at = notes.indexOf(BASE_METHOD_MARKER);
  if (at >= 0) {
    const end = notes.indexOf("]", at);
    if (end > at) return normalizePaymentMethod(notes.slice(at + BASE_METHOD_MARKER.length, end));
  }
  return "card";
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Fidelity points are always whole numbers (port of Fidelity::normalizePoints):
// floor toward zero with a tiny epsilon to absorb float leaks.
function normalizePoints(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 0) return Math.floor(n + 1e-9);
  if (n < 0) return Math.ceil(n - 1e-9);
  return 0;
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
