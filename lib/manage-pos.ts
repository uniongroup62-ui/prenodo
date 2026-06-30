import "server-only";

import { randomBytes } from "node:crypto";
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
  getDbAppointmentForEdit,
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

// The BUSINESS header for the printable POS receipt (scontrino) — port of the legacy
// pos_success.php business identity (name + P.IVA/legal_vat_number + address + logo). The
// name/address/logo come from the single `businesses` row (reusing the same source the
// business-profile page reads); the P.IVA + a legal address fallback come from the ACTIVE
// location's legal_* fields (legal_vat_number / legal_address live on `locations`, not
// `businesses`). All fields are schema-guarded so older installs still render a name-only
// header. `logoPath` is the public asset path ("/uploads/logo/...") used directly as <img src>.
export type PosBusinessHeader = {
  name: string;
  legalVatNumber: string;
  address: string;
  logoPath: string;
};

export type ManagePosContext = {
  ok: true;
  source: string;
  sourceMode: "database";
  activeLocationId: number;
  // Business identity for the printable receipt header (name / P.IVA / address / logo).
  business: PosBusinessHeader;
  summary: PosSummary;
  sales: PosSale[];
  catalog: {
    clients: ManagedClient[];
    services: ManagedService[];
    products: ManagedProduct[];
    // Sellable PACKAGE templates (id, name, price, total sessions, validity days) for the
    // "Vendi pacchetto" modal; selling one issues a client_packages row at checkout.
    packages: SellablePackage[];
    // Sellable GIFTBOX templates (id, name, default price, validity days, contents) for the
    // "Emetti GiftBox" modal; selling one issues a giftbox_instances row (+ its items copied
    // from the template's giftbox_items) owned by the recipient at checkout.
    giftboxes: SellableGiftbox[];
    // Sellable RECHARGE templates (id, title, base/bonus/total, earn-points flag) for the
    // "Ricarica credito" modal; selling one inserts a recharges row + CREDITS the wallet by
    // base+bonus (+ earns fidelity points) at checkout.
    rechargeTemplates: SellableRecharge[];
  };
  locations: Array<{ id: number; name: string }>;
};

// A package template the POS can SELL (port of the pos.php $packages query:
// SELECT id, name, price, sessions_total, validity_days FROM packages WHERE is_active=1).
// `sessions` is the bundle's total sessions (sum of package_services / package_items, or
// the packages.sessions_total fallback) — it becomes client_packages.sessions_total when
// the package is issued. `validityDays` seeds the proposed expiry (today + N days).
export type SellablePackage = {
  id: number;
  name: string;
  price: number;
  sessions: number;
  validityDays: number;
};

// A single content item of a sellable GiftBox template (one giftbox_items row): the source
// template item id (giftbox_items.id — copied into giftbox_instance_items.giftbox_item_id at
// issue), the item kind, the service/product it covers, the qty (units of that item), and the
// label. Mirrors the giftbox_items columns used by the redeem reader.
export type SellableGiftboxItem = {
  giftboxItemId: number;
  itemType: "service" | "product" | "custom";
  serviceId: number;
  productId: number;
  qty: number;
  label: string;
};

// A GiftBox template the POS can SELL (port of the GiftBox catalog: SELECT id, name,
// active, valid_from/valid_to/expires_after_days FROM giftboxes WHERE active=1 AND deleted_at
// IS NULL). The legacy `giftboxes` table has NO price column (a GiftBox is a fidelity-redeem
// voucher), so the SALE price is staff-entered in the modal (seeded by `price` = 0 here).
// `validityDays` seeds the proposed expiry (today + N days, from expires_after_days). `items`
// are the template's giftbox_items, copied into giftbox_instance_items when the box is issued.
export type SellableGiftbox = {
  id: number;
  name: string;
  price: number;
  validityDays: number;
  items: SellableGiftboxItem[];
};

// A RECHARGE template the POS can SELL — port of the recharge_templates catalog the legacy
// recharge modal precompiles from (SELECT id, title, base_amount, bonus_kind, bonus_value,
// earn_points FROM recharge_templates WHERE is_active=1 ORDER BY sort_order). The client PAYS
// `baseAmount` (the sale line price) and RECEIVES `baseAmount + bonusAmount` (the wallet
// credit). `bonusAmount` is computed from bonus_kind/bonus_value exactly like recharges-content
// (percent: base*value/100, fixed: value, none: 0). `earnPoints` decides whether fidelity
// points are earned on the bonus too (base+bonus) or on the base only. Custom (amount-only)
// recharges use templateId 0 and are configured entirely in the modal.
export type SellableRecharge = {
  id: number;
  title: string;
  baseAmount: number;
  bonusKind: string;
  bonusValue: number;
  bonusAmount: number;
  earnPoints: boolean;
};

const sourceLabel = "app/pages/pos.php + app/pages/pos_history.php";

export async function getManagePosContext(
  slug: string,
  options: { locationId?: number; includeCancelled?: boolean; query?: string } = {},
): Promise<ManagePosContext> {
  const locationContext = await getManageLocationContext(slug);
  const activeLocationId = normalizeLocationId(options.locationId ?? locationContext.currentLocationId, locationContext.locations);
  const [sales, clients, services, products, packages, giftboxes, rechargeTemplates, business] = await Promise.all([
    listPosSales(slug, { locationId: activeLocationId, includeCancelled: options.includeCancelled ?? true, query: options.query ?? "" }),
    listPosClients(slug),
    listPosServices(slug, activeLocationId),
    listPosProducts(slug, activeLocationId),
    listPosPackages(slug, activeLocationId),
    listPosGiftboxes(slug, activeLocationId),
    listPosRechargeTemplates(slug),
    getPosBusinessHeader(slug, activeLocationId),
  ]);

  return {
    ok: true,
    source: sourceLabel,
    sourceMode: "database",
    activeLocationId,
    business,
    summary: summarizeSales(sales),
    sales,
    catalog: { clients, services, products, packages, giftboxes, rechargeTemplates },
    locations: locationContext.locations.map((location) => ({ id: location.id, name: location.name })),
  };
}

// Read the BUSINESS header for the printable POS receipt — the business identity the legacy
// pos_success.php prints (name, P.IVA, address, logo). The name/address/logo come from the
// single `businesses` row (the same source the business-profile page reads via
// getBusinessProfile); the P.IVA (legal_vat_number) + a legal address fallback come from the
// ACTIVE location's legal_* fields (those columns live on `locations`, not `businesses`).
// Every column read is schema-guarded (a missing column / table degrades to ""), so older
// installs still get a name-only header. Best-effort: any error returns a name-only header
// (the slug) so the receipt always has something to print.
async function getPosBusinessHeader(slug: string, activeLocationId: number): Promise<PosBusinessHeader> {
  const fallback: PosBusinessHeader = { name: slug, legalVatNumber: "", address: "", logoPath: "" };
  try {
    const businessRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "businesses",
      columns: "*",
      orderBy: "id ASC",
      limit: 1,
    }).catch(() => [] as RowDataPacket[]);
    const business = businessRows[0] ?? null;

    // Active location legal fields (P.IVA + legal address) — schema-guarded read.
    let legalVatNumber = "";
    let legalAddress = "";
    if (activeLocationId > 0) {
      const locationRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "locations",
        columns: "*",
        where: "id=?",
        params: [activeLocationId],
        limit: 1,
      }).catch(() => [] as RowDataPacket[]);
      const location = locationRows[0] ?? null;
      if (location) {
        legalVatNumber = clean(location.legal_vat_number, 40);
        legalAddress = clean(location.address ?? location.legal_address, 255);
      }
    }

    const name = clean(business?.name, 190) || slug;
    const address = clean(business?.address, 255) || legalAddress;
    const logoPath = clean(business?.logo_path, 255);
    return { name, legalVatNumber, address, logoPath };
  } catch {
    return fallback;
  }
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

// "Vendita da appuntamento" pre-load: the cart seed for cashing out a completed
// appointment in the POS. Port of the legacy pos.php quote-import flow applied to an
// appointment — the POS opens pre-filled with the appointment's CLIENT + its SERVICE
// lines so a normal checkout records the sale AND marks the appointment 'done'
// (checkoutManageSale sets appointments.status='done' when appointmentId>0). Reuses
// getDbAppointmentForEdit (clientId/clientName + services[{serviceId,name}]) and enriches
// each service with the CURRENT catalog price (the same price a manually-clicked POS
// service tile would charge), so the staff sees the live list price. Tenant-scoped via the
// repo readers; returns ok=false (empty) when the appointment is missing / not the tenant's.
export type ManagePosAppointmentCart = {
  ok: boolean;
  appointmentId: number;
  publicCode: string | null;
  clientId: number;
  clientName: string;
  services: Array<{ serviceId: number; name: string; unitPrice: number; quantity: number }>;
};

export async function getManagePosAppointmentCart(slug: string, appointmentId: number): Promise<ManagePosAppointmentCart> {
  const id = Math.max(0, Number(appointmentId) || 0);
  const empty: ManagePosAppointmentCart = { ok: false, appointmentId: 0, publicCode: null, clientId: 0, clientName: "", services: [] };
  if (id <= 0) return empty;

  const appointment = await getDbAppointmentForEdit(slug, id).catch(() => null);
  if (!appointment) return empty;

  // Service catalog (id -> current list price) from the SAME source the POS tiles use, so a
  // pre-loaded line carries exactly the price a manual tile click would add. The POS catalog
  // price is the formatted "<n> euro" string -> parsed to a number here.
  const services = await listPosServices(slug, appointment.locationId ?? 0).catch(() => []);
  const priceById = new Map<number, number>();
  for (const service of services) {
    priceById.set(Number(service.id ?? 0), parsePriceLabel(service.price));
  }

  const cartServices = appointment.services
    .filter((service) => Number(service.serviceId ?? 0) > 0)
    .map((service) => ({
      serviceId: Number(service.serviceId),
      name: String(service.name ?? "Servizio"),
      // Current catalog list price (0 when the service is no longer in the catalog — the staff
      // can still adjust qty/remove the line, mirroring a manual add of an unpriced service).
      unitPrice: roundMoney(Math.max(0, priceById.get(Number(service.serviceId)) ?? 0)),
      quantity: 1,
    }));

  return {
    ok: true,
    appointmentId: id,
    publicCode: appointment.publicCode,
    clientId: Math.max(0, Number(appointment.clientId ?? 0) || 0),
    clientName: String(appointment.clientName ?? "").trim(),
    services: cartServices,
  };
}

// Parse a POS catalog price label ("12,00 euro" / "12.00") into a number. Mirrors the
// pos-content parsePrice helper so the seeded unit price matches what a tile click adds.
function parsePriceLabel(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").replace(/euro/gi, "").replace(/€/g, "").replace(/\s+/g, "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
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
    // SELL a GiftCard: issue a real giftcards row owned by the chosen recipient (so it
    // appears in their residui/voucher). The card amount is the line price (qty 1). A
    // bench sale (no buyer + no recipient picked) cannot own a card, so it is gated on a
    // resolvable recipient inside issueGiftcardFromSale.
    if (item.type === "giftcard") await issueGiftcardFromSale(slug, saleId, client.id, item, locationId);
    // SELL a GiftBox: issue a real giftbox_instances row (+ its items copied from the chosen
    // giftboxes template) OWNED by the recipient (defaults to the sale client), so it appears
    // in their residui and the drawer's giftbox redeem can consume it. A bench sale with no
    // resolvable recipient is skipped inside issueGiftboxFromSale.
    if (item.type === "giftbox") await issueGiftboxFromSale(slug, saleId, client.id, item, locationId);
    // SELL a RECHARGE: insert a recharges row (base/bonus/total/points), CREDIT the wallet by
    // base+bonus, and EARN fidelity points (when earn_points + eligible). A recharge tops up
    // a real client's wallet, so it requires client.id > 0 (a bench sale has no wallet).
    if (item.type === "recharge" && client.id > 0) await issueRechargeFromSale(slug, saleId, client.id, item, locationId, operator.id);
  }

  if (input.appointmentId && input.appointmentId > 0) {
    await tenantUpdate({ slug, table: "appointments", id: input.appointmentId, values: { status: "done" } }).catch(() => 0);
  }

  // RATEIZZAZIONE: when a rate plan was configured (count >= 2) AND the sale has a real
  // client + a positive total, write the sale_installment_plans row + N sale_installments
  // rows scheduling the financed remainder (total - downPayment). Faithful to pos.php's
  // `SaleInstallments::createPlan` call after the sale insert. The sale total + payments are
  // unchanged: the plan only schedules the financing (the down payment is collected at the
  // sale, the remainder over the installments). A bench sale (no client) or a single payment
  // skips this — mirroring the legacy `client_id <= 0` guard in createPlan.
  const plan = input.installmentPlan;
  if (plan && client.id > 0 && total > 0.00001 && Math.max(1, Math.round(plan.count)) >= 2) {
    await createManageInstallmentPlan(slug, {
      saleId,
      clientId: client.id,
      total,
      downPayment: plan.downPayment ?? 0,
      count: plan.count,
      intervalValue: plan.intervalValue ?? 1,
      intervalUnit: plan.intervalUnit ?? "month",
      firstDueDate: plan.firstDueDate ?? "",
      note: plan.note ?? "",
      paymentType: baseMethod,
      createdBy: operator.id,
    });
  }

  const sale = await getSale(slug, saleId);
  return {
    ...await getManagePosContext(slug, { locationId, includeCancelled: true }),
    sale,
  };
}

// Faithful port of SaleInstallments::createPlan (via preparePlanConfig + buildSchedule).
// Writes a sale_installment_plans row (down_payment_amount, financed_amount = total -
// downPayment, installments_count, interval_value/unit, first_due_date, last_due_date,
// sale_total, status 'active') + `count` sale_installments rows (installment_no 1..N,
// status 'pending'). The schedule splits the FINANCED amount (not the sale total): legacy
// buildSchedule works in cents — base = financedCents / count, remainder = financedCents -
// base*count, and the FIRST `remainder` installments each get +1 cent (front-loaded), so the
// row amounts sum exactly to the financed amount. Due dates step from first_due_date by
// interval_value * (i-1) of interval_unit (installment 1 = first_due_date itself, i.e. 0
// iterations). Best-effort: a no-op on installs without the tables (older installs).
async function createManageInstallmentPlan(
  slug: string,
  input: {
    saleId: number;
    clientId: number;
    total: number;
    downPayment: number;
    count: number;
    intervalValue: number;
    intervalUnit: "day" | "week" | "month";
    firstDueDate: string;
    note: string;
    paymentType: PosPaymentMethod;
    createdBy: number | null;
  },
): Promise<void> {
  try {
    const saleTotal = roundMoney(Math.max(0, input.total));
    if (saleTotal <= 0.00001) return;

    const count = Math.max(1, Math.min(120, Math.round(input.count)));
    if (count < 2) return;

    // Down payment (acconto) collected at the sale; must stay below the sale total so the
    // financed remainder is positive (legacy: downPayment >= saleTotal throws). Clamp it.
    const downPayment = roundMoney(Math.min(Math.max(0, input.downPayment), Math.max(0, saleTotal - 0.01)));
    const financed = roundMoney(saleTotal - downPayment);
    if (financed <= 0.00001) return;

    const intervalUnit: "day" | "week" | "month" =
      input.intervalUnit === "day" || input.intervalUnit === "week" ? input.intervalUnit : "month";
    const maxInterval = intervalUnit === "day" ? 365 : intervalUnit === "week" ? 52 : 24;
    const intervalValue = Math.max(1, Math.min(maxInterval, Math.round(input.intervalValue) || 1));

    const firstDue = normalizeInstallmentDate(input.firstDueDate) || addDaysIso(todayIso(), 30);
    const paymentType = installmentPaymentType(input.paymentType);

    // buildSchedule (cents, front-loaded remainder): the row amounts sum exactly to financed.
    const financedCents = Math.round(financed * 100);
    const base = Math.floor(financedCents / count);
    const remainder = financedCents - base * count;
    const schedule = Array.from({ length: count }, (_, idx) => {
      const no = idx + 1;
      const cents = base + (no <= remainder ? 1 : 0);
      return {
        installmentNo: no,
        dueDate: shiftInstallmentDate(firstDue, intervalUnit, intervalValue, idx),
        amount: roundMoney(cents / 100),
      };
    });
    const lastDue = schedule.length ? schedule[schedule.length - 1].dueDate : firstDue;

    const plansTable = await tenantTable(slug, "sale_installment_plans");
    const planId = await tenantInsert(plansTable, await filterColumns(plansTable.name, {
      sale_id: input.saleId,
      client_id: input.clientId,
      payment_type: paymentType,
      status: "active",
      sale_total: saleTotal,
      down_payment_amount: downPayment,
      financed_amount: financed,
      installments_count: count,
      interval_value: intervalValue,
      interval_unit: intervalUnit,
      first_due_date: firstDue,
      last_due_date: lastDue,
      notes: clean(input.note, 1000) || null,
      config_json: JSON.stringify({
        source: "next",
        client_id: input.clientId,
        sale_total: saleTotal,
        payment_type: paymentType,
        down_payment_amount: downPayment,
        financed_amount: financed,
        installments_count: count,
        interval_value: intervalValue,
        interval_unit: intervalUnit,
        first_due_date: firstDue,
        last_due_date: lastDue,
        schedule,
      }),
      created_by: input.createdBy,
      updated_by: input.createdBy,
    }));

    const installmentsTable = await tenantTable(slug, "sale_installments");
    for (const row of schedule) {
      await tenantInsert(installmentsTable, await filterColumns(installmentsTable.name, {
        plan_id: planId,
        sale_id: input.saleId,
        client_id: input.clientId,
        installment_no: row.installmentNo,
        due_date: row.dueDate,
        amount: row.amount,
        status: "pending",
        payment_type: paymentType,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      }));
    }
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

// Map the POS base method (PosPaymentMethod: cash/card/transfer/giftcard/wallet) to the
// installment payment_type enum SaleInstallments::normalizePaymentType yields (cash/card/
// check/bank). transfer -> bank; wallet/giftcard residui tenders default to card.
function installmentPaymentType(method: PosPaymentMethod): string {
  if (method === "cash") return "cash";
  if (method === "transfer") return "bank";
  return "card";
}

// Validate a YYYY-MM-DD installment date; "" when invalid (caller falls back to +30d).
function normalizeInstallmentDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dim = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > dim) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Port of SaleInstallments::shiftDate: step firstDue by interval_value * iterations of the
// unit (day/week/month). iterations === 0 returns the date unchanged (installment #1 lands on
// first_due_date). Month stepping clamps the day to the target month length (e.g. 31 -> 30/28).
function shiftInstallmentDate(date: string, unit: "day" | "week" | "month", value: number, iterations: number): string {
  const safeDate = normalizeInstallmentDate(date) || todayIso();
  const steps = Math.max(0, Math.round(iterations));
  if (steps === 0) return safeDate;
  const step = Math.max(1, Math.round(value));
  if (unit === "day") return addDaysIso(safeDate, step * steps);
  if (unit === "week") return addDaysIso(safeDate, step * steps * 7);
  return addMonthsIso(safeDate, step * steps);
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
  await cancelLinkedSaleResidues(slug, input.saleId, reason, saleRow, input.userId);

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

// Sellable PACKAGE templates for the POS, port of the pos.php $packages query
// (SELECT id, name, price, sessions_total, validity_days FROM packages WHERE is_active=1),
// location-filtered like services via package_locations. The total `sessions` is resolved
// the same way the legacy issue logic does (package_services -> package_items(service) ->
// packages.sessions_total), so the issued client_packages row gets the right session count.
async function listPosPackages(slug: string, locationId: number): Promise<SellablePackage[]> {
  const packagesTable = await tenantTable(slug, "packages").catch(() => null);
  if (!packagesTable) return [];
  const clauses = ["COALESCE(p.is_active,1)=1"];
  const params: unknown[] = [];
  if (packagesTable.mode === "shared" && await columnExists(packagesTable.name, "tenant_id")) {
    clauses.unshift("p.tenant_id=?");
    params.unshift(packagesTable.tenantId ?? 0);
  }
  const locationFilter = await packageLocationFilter(slug, locationId);
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT p.*
       FROM ${quoteIdentifier(packagesTable.name)} p
      WHERE ${clauses.join(" AND ")}
        ${locationFilter.sql}
      ORDER BY p.name ASC, p.id ASC`,
    [...params, ...locationFilter.params],
  ).catch(() => [] as RowDataPacket[]);
  return Promise.all(
    rows.map(async (row) => {
      const id = Number(row.id ?? 0);
      return {
        id,
        name: String(row.name ?? "Pacchetto"),
        price: roundMoney(Number(row.price ?? 0) || 0),
        sessions: await packageSessionsTotal(slug, id, row),
        validityDays: Math.max(0, Number(row.validity_days ?? 0) || 0),
      };
    }),
  );
}

// The total sessions a package grants, resolved exactly like the legacy issue logic:
// sum of package_services.sessions_total, else sum of package_items(item_type='service')
// qty, else packages.sessions_total (min 1). This becomes client_packages.sessions_total.
async function packageSessionsTotal(slug: string, packageId: number, packageRow?: RowDataPacket): Promise<number> {
  if (packageId > 0) {
    const serviceRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "package_services",
      columns: "sessions_total",
      where: "package_id=?",
      params: [packageId],
    }).catch(() => [] as RowDataPacket[]);
    if (serviceRows.length) {
      const sum = serviceRows.reduce((total, r) => total + Math.max(1, Number(r.sessions_total ?? 1) || 1), 0);
      if (sum > 0) return sum;
    }
    const itemRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "package_items",
      columns: "qty",
      where: "package_id=? AND LOWER(COALESCE(item_type,''))='service'",
      params: [packageId],
    }).catch(() => [] as RowDataPacket[]);
    if (itemRows.length) {
      const sum = itemRows.reduce((total, r) => total + Math.max(1, Number(r.qty ?? 1) || 1), 0);
      if (sum > 0) return sum;
    }
  }
  const fallback = Number(packageRow?.sessions_total ?? 1) || 1;
  return Math.max(1, fallback);
}

async function packageLocationFilter(slug: string, locationId: number): Promise<{ sql: string; params: unknown[] }> {
  if (locationId <= 0) return { sql: "", params: [] };
  const table = await tenantTable(slug, "package_locations").catch(() => null);
  if (!table) return { sql: "", params: [] };
  const tenantClause = table.mode === "shared" && await columnExists(table.name, "tenant_id") ? " AND pl.tenant_id=p.tenant_id" : "";
  return {
    sql: `AND (EXISTS(SELECT 1 FROM ${quoteIdentifier(table.name)} pl WHERE pl.package_id=p.id AND pl.location_id=?${tenantClause}) OR NOT EXISTS(SELECT 1 FROM ${quoteIdentifier(table.name)} pl_any WHERE pl_any.package_id=p.id${tenantClause.replaceAll("pl.", "pl_any.")}))`,
    params: [locationId],
  };
}

// Sellable GIFTBOX templates for the POS "Emetti GiftBox" modal — port of the GiftBox
// catalog (SELECT id, name, active, valid_from/valid_to/expires_after_days FROM giftboxes
// WHERE active=1 AND deleted_at IS NULL). Each template's contents are read from giftbox_items
// (item_type/service_id/product_id/qty/custom_label), so issueGiftboxFromSale can copy each
// into giftbox_instance_items. There is NO giftbox_locations table (only services/products are
// location-filtered, enforced per-item at issue time), so the catalog is not location-filtered
// here; `locationId` is accepted for signature parity with listPosPackages. Tolerates the
// giftbox tables being absent (-> empty list). The price is staff-entered in the modal (the
// giftboxes table has no price column), so `price` is 0 here.
async function listPosGiftboxes(slug: string, locationId: number): Promise<SellableGiftbox[]> {
  void locationId;
  const giftboxesTable = await tenantTable(slug, "giftboxes").catch(() => null);
  if (!giftboxesTable) return [];
  const clauses = ["COALESCE(g.active,1)=1"];
  const params: unknown[] = [];
  if (giftboxesTable.mode === "shared" && await columnExists(giftboxesTable.name, "tenant_id")) {
    clauses.unshift("g.tenant_id=?");
    params.unshift(giftboxesTable.tenantId ?? 0);
  }
  if (await columnExists(giftboxesTable.name, "deleted_at")) clauses.push("g.deleted_at IS NULL");
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT g.*
       FROM ${quoteIdentifier(giftboxesTable.name)} g
      WHERE ${clauses.join(" AND ")}
      ORDER BY COALESCE(g.sort_order,0) ASC, g.name ASC, g.id ASC`,
    params,
  ).catch(() => [] as RowDataPacket[]);
  return Promise.all(
    rows.map(async (row) => {
      const id = Number(row.id ?? 0);
      return {
        id,
        name: String(row.name ?? "GiftBox"),
        // No price column on giftboxes — the staff enters the SALE price in the modal.
        price: 0,
        // Validity days for the proposed expiry: the template's expires_after_days, else 0
        // (the issuer then falls back to the settings default or +180d).
        validityDays: Math.max(0, Number(row.expires_after_days ?? 0) || 0),
        items: await giftboxTemplateItems(slug, id),
      };
    }),
  );
}

// The content rows of a giftbox TEMPLATE (giftbox_items WHERE giftbox_id=?), normalized for
// the catalog + for issueGiftboxFromSale to copy into giftbox_instance_items. Preserves the
// template item id (giftbox_items.id), kind, service/product, qty + label. Tolerates the
// table being absent (-> empty list).
async function giftboxTemplateItems(slug: string, giftboxId: number): Promise<SellableGiftboxItem[]> {
  if (giftboxId <= 0) return [];
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "giftbox_items",
    columns: "id, item_type, service_id, product_id, qty, custom_label",
    where: "giftbox_id=?",
    params: [giftboxId],
    orderBy: "sort_order ASC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  return rows.map((row) => {
    const rawType = String(row.item_type ?? "service").toLowerCase();
    const itemType: SellableGiftboxItem["itemType"] = rawType === "product" ? "product" : rawType === "custom" ? "custom" : "service";
    return {
      giftboxItemId: Number(row.id ?? 0) || 0,
      itemType,
      serviceId: Number(row.service_id ?? 0) || 0,
      productId: Number(row.product_id ?? 0) || 0,
      qty: Math.max(1, Number(row.qty ?? 1) || 1),
      label: String(row.custom_label ?? ""),
    };
  });
}

// Sellable RECHARGE templates for the POS "Ricarica credito" modal — port of the
// recharge_templates catalog the legacy modal precompiles from (SELECT id, title,
// base_amount, bonus_kind, bonus_value, earn_points FROM recharge_templates WHERE
// is_active=1 ORDER BY sort_order, title). The bonus is computed exactly like
// recharges-content.tsx (percent: base*value/100, fixed: value, none: 0). There is no
// recharge_locations table, so the catalog is not location-filtered. Tolerates the table
// being absent (-> empty list).
async function listPosRechargeTemplates(slug: string): Promise<SellableRecharge[]> {
  const table = await tenantTable(slug, "recharge_templates").catch(() => null);
  if (!table) return [];
  const clauses = ["COALESCE(t.is_active,1)=1"];
  const params: unknown[] = [];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("t.tenant_id=?");
    params.unshift(table.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT t.*
       FROM ${quoteIdentifier(table.name)} t
      WHERE ${clauses.join(" AND ")}
      ORDER BY COALESCE(t.sort_order,0) ASC, t.title ASC, t.id ASC`,
    params,
  ).catch(() => [] as RowDataPacket[]);
  return rows.map((row) => {
    const baseAmount = roundMoney(Math.max(0, Number(row.base_amount ?? 0) || 0));
    const bonusKind = normalizeBonusKind(row.bonus_kind);
    const bonusValue = roundMoney(Math.max(0, Number(row.bonus_value ?? 0) || 0));
    return {
      id: Number(row.id ?? 0) || 0,
      title: String(row.title ?? "Ricarica"),
      baseAmount,
      bonusKind,
      bonusValue,
      bonusAmount: rechargeBonusAmount(baseAmount, bonusKind, bonusValue),
      earnPoints: Number(row.earn_points ?? 1) === 1,
    };
  });
}

// The € bonus credit for a recharge — faithful to recharges-content.tsx bonusAmount():
// percent -> base*value/100, fixed -> value, none/other -> 0. Always >= 0, money-rounded.
function rechargeBonusAmount(baseAmount: number, bonusKind: string, bonusValue: number): number {
  const base = Math.max(0, Number(baseAmount) || 0);
  const value = Math.max(0, Number(bonusValue) || 0);
  if (bonusKind === "percent") return roundMoney((base * value) / 100);
  if (bonusKind === "fixed") return roundMoney(value);
  return 0;
}

// Clamp a bonus kind to the schema's CHECK ('none','percent','fixed'), defaulting to 'none'.
function normalizeBonusKind(value: unknown): string {
  const kind = String(value ?? "none").toLowerCase();
  return kind === "percent" || kind === "fixed" ? kind : "none";
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

    // Special line types (package / prepaid / giftcard / giftbox). For a PACKAGE the cart
    // line is a single unit at the package price (faithful to pos.php pkAddRowToCart: qty
    // is fixed to 1, the line price is the bundle price); the validity/expiry/note ride on
    // the line meta and the issued sessions are read from the package template, NOT the
    // line qty. For a PREPAID line the qty IS the purchased session count (per-session
    // unitPrice), so it flows straight into client_prepaid_services.purchased_qty.
    // A GIFTCARD line is also a single unit at the card amount (faithful to the legacy
    // issue_giftcard sale_items row: qty 1, unit_price = line_total = amount), so the sale
    // TOTAL equals the giftcard amount. The recipient/code/expiry/dedica/hide-amount ride
    // on the line meta and are read by issueGiftcardFromSale at checkout.
    // A GIFTBOX line is also a single unit at the box price (like a giftcard); the recipient
    // OWNER + expiry/event/dedica ride on the line meta and are read by issueGiftboxFromSale.
    // A RECHARGE line is also a single unit, but its price is the BASE amount (what the client
    // pays); the base/bonus/total + earn-points flag ride on the line meta and are read by
    // issueRechargeFromSale (which credits the wallet by base+bonus and earns points). The
    // bonus is free credit, so it is NEVER added to the sale line price.
    const isPackage = input.type === "package";
    const isGiftcard = input.type === "giftcard";
    const isGiftbox = input.type === "giftbox";
    const isRecharge = input.type === "recharge";
    const isVoucher = isGiftcard || isGiftbox; // shares the recipient/expiry/event/dedica meta
    const lineQty = isPackage || isVoucher || isRecharge ? 1 : quantity;
    // Recharge line price = the base amount (the client pays the base; the bonus is free). For
    // every other special line the price is the supplied unitPrice.
    const rechargeBase = isRecharge
      ? roundMoney(Math.max(0, Number(input.baseAmount ?? input.unitPrice ?? 0) || 0))
      : 0;
    const unitPrice = isRecharge ? rechargeBase : roundMoney(input.unitPrice ?? 0);
    // Recharge bonus/total: trust the client's bonus_kind/bonus_value and RECOMPUTE the bonus
    // server-side (never trust a client-sent total), then total = base + bonus.
    const rechargeBonusKind = isRecharge ? normalizeBonusKind(input.bonusKind) : "none";
    const rechargeBonusValue = isRecharge ? roundMoney(Math.max(0, Number(input.bonusValue ?? 0) || 0)) : 0;
    const rechargeBonus = isRecharge ? rechargeBonusAmount(rechargeBase, rechargeBonusKind, rechargeBonusValue) : 0;
    const rechargeTotal = isRecharge ? roundMoney(rechargeBase + rechargeBonus) : 0;
    items.push({
      id: index + 1,
      type: input.type,
      refId,
      name: input.name?.trim() || fallbackItemName(input.type),
      quantity: lineQty,
      unitPrice,
      total: roundMoney(unitPrice * lineQty),
      status: "prepaid",
      startDate: clean(input.startDate, 10) || undefined,
      expiresAt: clean(input.expiresAt, 10) || undefined,
      note: clean(input.note, 255) || undefined,
      recipientClientId: isVoucher ? Math.max(0, Number(input.recipientClientId ?? 0) || 0) || undefined : undefined,
      recipientName: isVoucher ? clean(input.recipientName, 120) || undefined : undefined,
      recipientEmail: isVoucher ? clean(input.recipientEmail, 190) || undefined : undefined,
      code: isGiftcard ? clean(input.code, 24).toUpperCase() || undefined : undefined,
      eventType: isVoucher ? clean(input.eventType, 40) || undefined : undefined,
      message: isVoucher ? clean(input.message, 2000) || undefined : undefined,
      hideAmount: isVoucher ? input.hideAmount === true : undefined,
      baseAmount: isRecharge ? rechargeBase : undefined,
      bonusKind: isRecharge ? rechargeBonusKind : undefined,
      bonusValue: isRecharge ? rechargeBonusValue : undefined,
      bonusAmount: isRecharge ? rechargeBonus : undefined,
      totalAmount: isRecharge ? rechargeTotal : undefined,
      earnPoints: isRecharge ? input.earnPoints === true : undefined,
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

async function cancelLinkedSaleResidues(slug: string, saleId: number, reason: string, saleRow?: RowDataPacket, voidedBy: number | null = null): Promise<void> {
  await updateBySaleId(slug, "client_prepaid_services", saleId, { status: "cancelled", canceled_at: new Date(), cancel_note: reason });
  await updateBySaleId(slug, "client_packages", saleId, { status: "canceled", updated_at: new Date() });
  await updateBySaleId(slug, "sale_installment_plans", saleId, { status: "cancelled", cancelled_at: new Date(), cancelled_reason: reason });
  await updateBySaleId(slug, "sale_installments", saleId, { status: "cancelled", note: reason });

  // CANCEL the GiftCard this sale ISSUED (the SELL path): flip the card to 'cancelled' +
  // write a reversal ledger row. Found by the issue transaction's sale marker, NOT by
  // sales.giftcard_id (that column is the RESIDUI card the sale SPENT — a different card,
  // restored below). Keyed off the sale linkage so the two never collide.
  await cancelIssuedSaleGiftcards(slug, saleId, reason);

  // CANCEL the GiftBox this sale ISSUED (the SELL path): flip the issued instance to
  // 'cancelled'. Found by the instance's sale-linkage note ('Vendita #saleId') since
  // giftbox_instances has no sale_id column. Kept distinct from the drawer's giftbox-redeem
  // restore (which reverses a CONSUMED giftbox via giftbox_redemptions) — a different
  // operation keyed off the sale linkage, so the two never collide.
  await cancelIssuedSaleGiftboxes(slug, saleId, reason);

  // REVERSE the RECHARGE this sale ISSUED (the SELL path): flip each recharges row for this
  // sale to is_void=1 (+ voided_at/by), DEBIT the wallet by total_amount (the inverse of the
  // top-up credit) and reverse the earned points (points_redeem). Found by recharges.sale_id
  // (the table HAS sale_id + is_void). Idempotent: only a not-yet-void row is reversed, so a
  // re-void is a no-op. Kept distinct from the residui-credit restore below (that re-credits
  // SPENT credit, keyed off sales.credit_used) — both touch clients.credit_balance but are
  // linked to different rows/notes and guarded by recharges.is_void, so they never collide.
  await reverseIssuedSaleRecharges(slug, saleId, voidedBy);

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

// Cancel any GiftCard(s) this sale ISSUED (the SELL path), found via the 'issue'
// giftcard_transactions row tagged with the sale marker (meta_json or note). Flips each
// still-active card to status='cancelled' (+ cancelled_at / cancelled_reason) and writes a
// 'cancel' reversal ledger row so the issued credit is voided. Best-effort + idempotent:
// only an 'active'/'redeemed' card is touched (a card already cancelled / used elsewhere is
// left as-is), so a re-void is a no-op. This is distinct from the residui restore which
// reverses a card the sale SPENT (keyed off sales.giftcard_id) — keyed off sale linkage so
// the two giftcards (sold vs spent) never collide.
async function cancelIssuedSaleGiftcards(slug: string, saleId: number, reason: string): Promise<void> {
  const txTable = await tenantTable(slug, "giftcard_transactions").catch(() => null);
  const giftcardTable = await tenantTable(slug, "giftcards").catch(() => null);
  if (!txTable || !giftcardTable) return;

  // Find the issue rows for this sale. Match the meta_json sale_id (preferred) or the note
  // marker — both written by issueGiftcardFromSale. Scoped to type='issue' so only the SELL
  // ledger row matches (a redeem/cancel row for the same card is ignored).
  const marker = `%${GIFTCARD_SALE_MARKER}${saleId}]%`;
  const metaMatch = `%"sale_id":${saleId}%`;
  const txRows = await tenantSelect<RowDataPacket>({
    slug,
    table: txTable.name,
    columns: "giftcard_id",
    where: "type = 'issue' AND (meta_json LIKE ? OR note LIKE ?)",
    params: [metaMatch, marker],
  }).catch(() => [] as RowDataPacket[]);

  const seen = new Set<number>();
  for (const tx of txRows) {
    const giftcardId = Math.max(0, Number(tx.giftcard_id ?? 0) || 0);
    if (giftcardId <= 0 || seen.has(giftcardId)) continue;
    seen.add(giftcardId);

    const cardRows = await tenantSelect<RowDataPacket>({
      slug,
      table: giftcardTable.name,
      columns: "id, balance, status",
      where: "id = ?",
      params: [giftcardId],
      limit: 1,
    }).catch(() => [] as RowDataPacket[]);
    const card = cardRows[0];
    if (!card) continue;
    const status = String(card.status ?? "").toLowerCase();
    // Idempotent: skip a card already cancelled/expired (a re-void must not re-cancel).
    if (status === "cancelled" || status === "canceled" || status === "expired") continue;
    const balance = roundMoney(Math.max(0, Number(card.balance ?? 0) || 0));

    await tenantUpdate({
      slug,
      table: giftcardTable.name,
      id: giftcardId,
      values: { status: "cancelled", cancelled_at: new Date(), cancelled_reason: clean(reason, 255) || `Storno vendita #${saleId}` },
    }).catch(() => 0);

    await tenantInsert(txTable, await filterColumns(txTable.name, {
      giftcard_id: giftcardId,
      type: "cancel",
      // Reverse the still-available balance (negative), mirroring the legacy cancel ledger.
      amount: -balance,
      note: `Annullamento GiftCard (storno vendita #${saleId})`,
      meta_json: JSON.stringify({ source: "sale_cancel", sale_id: saleId }),
      created_at: new Date(),
    })).catch(() => undefined);
  }
}

// Cancel any GiftBox instance(s) this sale ISSUED (the SELL path), found via the sale-linkage
// note 'Vendita #saleId' written by issueGiftboxFromSale (giftbox_instances has no sale_id
// column). Flips each still-issued instance to status='cancelled' (+ cancelled_at) and writes a
// 'cancel' giftbox_transactions audit row, leaving its giftbox_instance_items intact. Best-effort
// + idempotent: only an 'issued'/'active' instance is touched (one already cancelled/redeemed/
// expired is left as-is), so a re-void is a no-op. This is distinct from the drawer's giftbox-
// redeem restore (restoreGiftboxRedemption), which reverses a CONSUMED giftbox via
// giftbox_redemptions — keyed off the sale linkage so the issued vs consumed boxes never collide.
async function cancelIssuedSaleGiftboxes(slug: string, saleId: number, reason: string): Promise<void> {
  const instanceTable = await tenantTable(slug, "giftbox_instances").catch(() => null);
  if (!instanceTable) return;
  if (!(await columnExists(instanceTable.name, "note"))) return;

  const marker = `${GIFTBOX_SALE_MARKER}${saleId}`;
  // Exact-note match (the issuer writes the note as exactly 'Vendita #saleId'). LIKE-escape the
  // marker so a numeric saleId can't introduce wildcards (it can't, but stay defensive).
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: instanceTable.name,
    columns: "id, status",
    where: "note = ?",
    params: [marker],
  }).catch(() => [] as RowDataPacket[]);

  const txTable = await tenantTable(slug, "giftbox_transactions").catch(() => null);
  for (const row of rows) {
    const instanceId = Math.max(0, Number(row.id ?? 0) || 0);
    if (instanceId <= 0) continue;
    const status = String(row.status ?? "").toLowerCase();
    // Idempotent: only an issued/active instance is cancelled (a re-void must not re-cancel a
    // box already cancelled/redeemed/expired).
    if (status !== "issued" && status !== "active") continue;

    await tenantUpdate({
      slug,
      table: instanceTable.name,
      id: instanceId,
      values: { status: "cancelled", cancelled_at: new Date() },
    }).catch(() => 0);

    if (txTable) {
      await tenantInsert(txTable, await filterColumns(txTable.name, {
        instance_id: instanceId,
        type: "cancel",
        amount: 0,
        note: clean(`Annullamento GiftBox (storno vendita #${saleId}): ${reason}`, 255),
        meta_json: JSON.stringify({ source: "sale_cancel", sale_id: saleId }),
        created_at: new Date(),
      })).catch(() => undefined);
    }
  }
}

// Reverse any RECHARGE(s) this sale ISSUED (the SELL path), found via recharges.sale_id (the
// table HAS sale_id + is_void). For each not-yet-void row: flip is_void=1 (+ voided_at/by),
// DEBIT the wallet by total_amount (a negative 'debit' movement — credit_adjustments row +
// clients.credit_balance decrement, the inverse of the top-up credit) and reverse the earned
// points (a negative 'points_redeem' movement — transactions row + clients.points decrement,
// the inverse of the earned points). Best-effort + idempotent: a row already void is skipped,
// so a re-void is a no-op. Kept distinct from the residui-credit restore (which RE-CREDITS
// credit the sale SPENT, keyed off sales.credit_used) — guarded by recharges.is_void so the
// two credit_balance operations never collide.
async function reverseIssuedSaleRecharges(slug: string, saleId: number, voidedBy: number | null): Promise<void> {
  const table = await tenantTable(slug, "recharges").catch(() => null);
  if (!table) return;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: table.name,
    columns: "id, client_id, total_amount, points_earned, is_void",
    where: "sale_id=?",
    params: [saleId],
  }).catch(() => [] as RowDataPacket[]);

  for (const row of rows) {
    const rechargeId = Math.max(0, Number(row.id ?? 0) || 0);
    if (rechargeId <= 0) continue;
    // Idempotent: skip a recharge already voided (a re-void must not double-debit).
    if (Number(row.is_void ?? 0) === 1) continue;
    const clientId = Math.max(0, Number(row.client_id ?? 0) || 0);
    const totalAmount = roundMoney(Math.max(0, Number(row.total_amount ?? 0) || 0));
    const pointsEarned = normalizePoints(Number(row.points_earned ?? 0) || 0);

    // Flip is_void FIRST so the row is guarded even if a wallet movement throws (a re-void
    // then skips it). Schema-guarded via filterColumns.
    await tenantUpdate({
      slug,
      table: table.name,
      id: rechargeId,
      values: { is_void: 1, voided_at: new Date(), voided_by: voidedBy },
    }).catch(() => 0);

    if (clientId > 0 && totalAmount > 0) {
      // DEBIT the wallet by the credited total (negative -> credit_adjustments debit row +
      // clients.credit_balance decrement), the inverse of the issue-time top-up credit.
      await addDbWalletMovement(
        { clientId, type: "debit", amount: -totalAmount, note: `Storno ricarica vendita #${saleId}` },
        slug,
      ).catch(() => undefined);
    }
    if (clientId > 0 && pointsEarned > 0) {
      // REVERSE the earned points (negative points_redeem -> transactions row +
      // clients.points decrement), the inverse of the issue-time points_earn.
      await addDbWalletMovement(
        { clientId, type: "points_redeem", points: -pointsEarned, source: "recharge", note: `Storno punti ricarica vendita #${saleId}` },
        slug,
      ).catch(() => undefined);
    }
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
  // Sessions come from the package TEMPLATE (sum of package_services / package_items, or
  // packages.sessions_total) — faithful to the legacy issue logic, NOT the cart qty (the
  // package line is always qty 1 at the bundle price). Fall back to the line qty only when
  // the template can't be read (e.g. ad-hoc package with no id).
  const packageRow = item.refId > 0 ? await packageRowById(slug, item.refId) : null;
  const sessions = item.refId > 0
    ? await packageSessionsTotal(slug, item.refId, packageRow ?? undefined)
    : Math.max(1, item.quantity);
  // Expiry: the custom "Valido al" the staff picked, else today + the template's
  // validity_days (pkCalculatePackageExpiry base case), else null.
  const startDate = item.startDate && /^\d{4}-\d{2}-\d{2}$/.test(item.startDate) ? item.startDate : todayIso();
  let expiresAt: string | null = item.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresAt) ? item.expiresAt : null;
  if (!expiresAt) {
    const validityDays = Math.max(0, Number(packageRow?.validity_days ?? 0) || 0);
    if (validityDays > 0) expiresAt = addDaysIso(startDate, validityDays);
  }
  await tenantInsert(table, await filterColumns(table.name, {
    client_id: clientId,
    sale_id: saleId,
    package_id: item.refId > 0 ? item.refId : null,
    package_name: item.name,
    service_id: Number(packageRow?.service_id ?? 0) || null,
    purchase_date: todayIso(),
    start_date: startDate,
    expires_at: expiresAt,
    sessions_total: sessions,
    sessions_remaining: sessions,
    status: "active",
    notes: item.note ?? null,
  })).catch(() => undefined);
}

async function packageRowById(slug: string, id: number): Promise<RowDataPacket | null> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "packages", where: "id=?", params: [id], limit: 1 }).catch(() => []);
  return rows[0] ?? null;
}

// SELL a RECHARGE at checkout — faithful port of the pos.php recharge action (~2195-2259) +
// recharge_templates. Inserts a `recharges` row (base/bonus/total/earn_points/points_earned,
// template_id, sale_id, location_id, created_by), CREDITS the wallet by total_amount
// (addDbWalletMovement type 'recharge', positive — inserts a credit_adjustments row +
// increments clients.credit_balance), and EARNS fidelity points (addDbWalletMovement
// 'points_earn', positive — inserts a transactions row + increments clients.points) when
// earn_points is set AND the client is eligible. The client PAID the base_amount (the sale
// line) and RECEIVES base+bonus as credit; the bonus is free credit. Skips silently when the
// total is not positive. Returns the new recharges id (0 when not issued).
async function issueRechargeFromSale(
  slug: string,
  saleId: number,
  clientId: number,
  item: PosSaleItem,
  locationId: number,
  createdBy: number | null,
): Promise<number> {
  const table = await tenantTable(slug, "recharges").catch(() => null);
  if (!table) return 0;
  if (clientId <= 0) return 0;

  // Base = the line price (qty forced to 1, so total === unitPrice). Bonus/total ride on the
  // line meta (recomputed server-side in buildSaleItems, never trusting a client total).
  const baseAmount = roundMoney(Math.max(0, Number(item.baseAmount ?? item.total ?? item.unitPrice ?? 0) || 0));
  if (baseAmount <= 0.00001) return 0;
  const bonusKind = normalizeBonusKind(item.bonusKind);
  const bonusValue = roundMoney(Math.max(0, Number(item.bonusValue ?? 0) || 0));
  const bonusAmount = roundMoney(Math.max(0, Number(item.bonusAmount ?? rechargeBonusAmount(baseAmount, bonusKind, bonusValue)) || 0));
  const totalAmount = roundMoney(baseAmount + bonusAmount);
  const earnPointsFlag = item.earnPoints === true;
  const templateId = Math.max(0, Number(item.refId ?? 0) || 0);

  // POINTS: faithful to pos_recharge_points_info — earn only when the template's earn_points
  // flag is set AND the client is recharge-points eligible. The earn BASE is base+bonus when
  // the flag is set (the legacy "Importo + bonus" rule the modal exposes), else base only.
  // The points themselves are computed from the fidelity earn rule (floor(amount / earn_step)).
  // TODO(parity): the full eligibility (campaign windows + min_spend + card levels via
  // Fidelity::calcEarnPointsForAmountWithCampaign / credit_wallet_recharge_points_eligible) is
  // NOT ported — only the global fidelity_enabled gate + the flat earn-step rate. A campaign
  // (fidelity_campaigns) or level-restricted earn would diverge here.
  const earnSettings = await getFidelityEarnSettings(slug);
  const eligible = earnPointsFlag && earnSettings.enabled;
  const earnBase = earnSettings.earnOnBonus ? totalAmount : baseAmount;
  const pointsEarned = eligible ? earnFidelityPoints(earnBase, earnSettings.earnStep) : 0;

  const note = rechargeNote(baseAmount, bonusAmount, pointsEarned, item.note);

  const rechargeId = await tenantInsert(table, await filterColumns(table.name, {
    client_id: clientId,
    card_id: 0,
    template_id: templateId > 0 ? templateId : null,
    sale_id: saleId,
    location_id: locationId > 0 ? locationId : null,
    base_amount: baseAmount,
    bonus_kind: bonusKind,
    bonus_value: bonusValue,
    bonus_amount: bonusAmount,
    total_amount: totalAmount,
    earn_points: eligible ? 1 : 0,
    points_earned: pointsEarned,
    note,
    is_void: 0,
    created_at: new Date(),
    created_by: createdBy,
  })).catch(() => 0);
  if (!rechargeId) return 0;

  // CREDIT the wallet by base+bonus (a positive 'recharge' movement: credit_adjustments row +
  // clients.credit_balance increment), tagged with the sale id so a later void can reverse it.
  await addDbWalletMovement(
    { clientId, type: "recharge", amount: totalAmount, note: `Ricarica vendita #${saleId}` },
    slug,
  ).catch(() => undefined);

  // EARN the fidelity points (a positive 'points_earn' movement: transactions row +
  // clients.points increment), tagged with the sale id so a later void can reverse them.
  if (pointsEarned > 0) {
    await addDbWalletMovement(
      { clientId, type: "points_earn", points: pointsEarned, source: "recharge", note: `Punti ricarica vendita #${saleId}` },
      slug,
    ).catch(() => undefined);
  }

  return rechargeId;
}

// The recharge fidelity EARN settings — port of Fidelity::settings() earn block (always
// 'amount' mode now): fidelity_enabled gate + the flat earn step (€ per point). `earnOnBonus`
// is ALWAYS true here (the per-template earn_points flag already decides whether points are
// earned at all; when earned, the base is base+bonus per the modal's "Importo + bonus" copy).
// Schema-guarded: a missing column / table falls back to disabled with a 10€ step.
type FidelityEarnSettings = { enabled: boolean; earnStep: number; earnOnBonus: boolean };

async function getFidelityEarnSettings(slug: string): Promise<FidelityEarnSettings> {
  const defaults: FidelityEarnSettings = { enabled: false, earnStep: 10, earnOnBonus: true };
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "businesses",
      columns: "fidelity_enabled,fidelity_points_enabled,fidelity_earn_step_euro",
      orderBy: "id ASC",
      limit: 1,
    });
    const row = rows[0];
    if (!row) return defaults;
    const enabled = Number(row.fidelity_enabled ?? 0) === 1 && Number(row.fidelity_points_enabled ?? 1) === 1;
    let earnStep = Number(row.fidelity_earn_step_euro ?? 10);
    if (!Number.isFinite(earnStep) || earnStep <= 0) earnStep = 10;
    if (earnStep > 100000) earnStep = 100000;
    return { enabled, earnStep: roundMoney(earnStep), earnOnBonus: true };
  } catch {
    return defaults;
  }
}

// Points earned for an amount — port of Fidelity::calcEarnPointsWithStep (floor(amount/step),
// whole points). Returns 0 when the step or amount is non-positive.
function earnFidelityPoints(amount: number, earnStep: number): number {
  const value = Math.max(0, Number(amount) || 0);
  const step = Number(earnStep) || 0;
  if (step <= 0 || value <= 0) return 0;
  return normalizePoints(value / step);
}

// The recharge ledger note — faithful to the legacy "Ricarica credito: € base • +N Punti • user".
function rechargeNote(baseAmount: number, bonusAmount: number, pointsEarned: number, userNote?: string): string {
  const parts = [`Ricarica credito: € ${formatMoney(baseAmount)}`];
  if (bonusAmount > 0.00001) parts.push(`bonus € ${formatMoney(bonusAmount)}`);
  if (pointsEarned > 0.00001) parts.push(`+${pointsEarned} Punti`);
  const note = clean(userNote, 180);
  if (note) parts.push(note);
  return clean(parts.join(" • "), 255);
}

// Marker stored on the issue giftcard_transactions row (note + meta_json) so a later sale
// VOID can find the giftcard this sale ISSUED — the giftcards table has no sale_id column,
// so the sale linkage rides on the issue ledger entry. cancelLinkedSaleResidues parses it
// back to flip the issued card to 'cancelled' (kept distinct from a RESIDUI giftcard that
// was merely spent on the sale — that is a different card, keyed off sales.giftcard_id).
const GIFTCARD_SALE_MARKER = "[possale:";

// Marker stored on the issued giftbox_instances.note so a later sale VOID can find the
// giftbox(es) this sale ISSUED — the giftbox_instances table has NO sale_id column, so the
// sale linkage rides on the note (faithful to the legacy 'Vendita #saleId' note convention).
// cancelLinkedSaleResidues parses it back to flip the issued instance to 'cancelled'. Kept
// distinct from the drawer's giftbox-redeem restore (that reverses a CONSUMED giftbox via
// giftbox_redemptions, a different operation), so the two never collide.
const GIFTBOX_SALE_MARKER = "Vendita #";

// SELL a GiftCard at checkout — faithful port of GiftCard::issueGiftCard (app/lib/GiftCard.php
// ~1465) + the pos.php issue_giftcard action (~2781). Inserts a `giftcards` row owned by the
// recipient (recipient_client_id, so it surfaces in their residui/voucher) with a unique
// uppercase CODE, initial_amount + balance = the line amount, status='active', issued_at,
// expires_at (from the giftcard validity setting, default +12 months / +365d), location_id,
// and the voucher fields (voucher_public_token + voucher_hide_amount / email_show_amount).
// Also writes the 'issue' giftcard_transactions ledger row tagged with the sale id (note +
// meta_json) for the void reversal. Returns the new giftcards id (0 when not issued).
// Optional issue email is OUT OF SCOPE (the giftcard-send cron delivers it) — see TODO below.
async function issueGiftcardFromSale(slug: string, saleId: number, clientId: number, item: PosSaleItem, locationId: number): Promise<number> {
  const giftcardTable = await tenantTable(slug, "giftcards").catch(() => null);
  if (!giftcardTable) return 0;

  // Amount = the line price (qty is forced to 1, so total === unitPrice). Faithful to the
  // legacy sale_items row: 1 @ amount. Skip silently when the amount is not positive.
  const amount = roundMoney(Math.max(0, item.total > 0 ? item.total : item.unitPrice));
  if (amount <= 0) return 0;

  // Owner = the recipient client the staff picked (defaults to the sale buyer). A card with
  // no owner cannot show in any residui, so a bench sale with no recipient is skipped.
  const recipientClientId = Math.max(0, Number(item.recipientClientId ?? 0) || 0) || (clientId > 0 ? clientId : 0);
  const hasRecipientColumn = await columnExists(giftcardTable.name, "recipient_client_id");
  if (recipientClientId <= 0 && (!item.recipientName || !item.recipientName.trim())) return 0;

  const recipientName = clean(item.recipientName, 120)
    || (recipientClientId > 0 ? await clientName(slug, recipientClientId) : "")
    || "Destinatario";
  const recipientEmail = clean(item.recipientEmail, 190) || null;

  // CODE: honour a custom uppercase code (must be unique), else generate a unique one in the
  // legacy GC-XXXX-XXXX-XXXX format (unambiguous alphabet, no O/0 or I/1).
  const code = await resolveUniqueGiftcardCode(slug, giftcardTable.name, item.code);

  // EXPIRY: the custom "Valida al" the staff set, else the giftcard validity default from
  // the businesses settings (value + unit), else +365d (task fallback ~12 months).
  const issuedAtYmd = todayIso();
  let expiresAt: string | null = item.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresAt) ? item.expiresAt : null;
  if (!expiresAt) expiresAt = await defaultGiftcardExpiry(slug, issuedAtYmd);

  const hideAmount = item.hideAmount === true ? 1 : 0;
  const hasTokenColumn = await columnExists(giftcardTable.name, "voucher_public_token");

  const giftcardId = await tenantInsert(giftcardTable, await filterColumns(giftcardTable.name, {
    voucher_public_token: hasTokenColumn ? randomHex(64) : undefined,
    code,
    client_id: clientId > 0 ? clientId : null,
    recipient_client_id: hasRecipientColumn ? (recipientClientId > 0 ? recipientClientId : null) : undefined,
    recipient_name: recipientName,
    recipient_email: recipientEmail,
    event_type: clean(item.eventType, 32) || "giftcard",
    voucher_hide_amount: hideAmount,
    // email_show_amount mirrors the modal hide-amount toggle (legacy default 1 = show).
    email_show_amount: hideAmount ? 0 : 1,
    initial_amount: amount,
    balance: amount,
    currency: "EUR",
    status: "active",
    issued_at: new Date(),
    expires_at: expiresAt,
    gift_message: clean(item.message, 2000) || null,
    note: `Emessa da vendita #${saleId}`,
    location_id: locationId > 0 ? locationId : null,
  })).catch(() => 0);
  if (!giftcardId) return 0;

  // 'issue' ledger row, tagged with the sale id (note marker + meta_json) so the void
  // reversal can find this exact card. Best-effort: a missing transactions table is a no-op.
  const txTable = await tenantTable(slug, "giftcard_transactions").catch(() => null);
  if (txTable) {
    await tenantInsert(txTable, await filterColumns(txTable.name, {
      giftcard_id: giftcardId,
      type: "issue",
      amount,
      note: `Emissione GiftCard ${GIFTCARD_SALE_MARKER}${saleId}]`,
      meta_json: JSON.stringify({ source: "sale", sale_id: saleId }),
      created_at: new Date(),
      location_id: locationId > 0 ? locationId : null,
    })).catch(() => undefined);
  }

  // TODO: optional issue email (recipient_email / scheduled_send_on). Out of scope here —
  // the giftcard-send cron (GiftCard::sendDueScheduledGiftCards) handles delivery.
  return giftcardId;
}

// Unique uppercase giftcard CODE — port of GiftCard::generateCode (GC-XXXX-XXXX-XXXX,
// unambiguous alphabet) + the issueGiftCard 20-try uniqueness loop, mirroring the
// generateUniqueAppointmentPublicCode pattern. A staff-supplied custom code is honoured
// when free (uppercased, <= 24 chars); otherwise codes are generated until one is unused.
async function resolveUniqueGiftcardCode(slug: string, tableName: string, customCode?: string): Promise<string> {
  const custom = clean(customCode, 24).toUpperCase();
  if (custom && !(await giftcardCodeExists(slug, tableName, custom))) return custom;
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateGiftcardCode();
    if (!(await giftcardCodeExists(slug, tableName, code))) return code;
  }
  // Extremely unlikely fallthrough: append a timestamp suffix to force uniqueness.
  return generateGiftcardCode().slice(0, 16) + Date.now().toString(36).toUpperCase().slice(-4);
}

async function giftcardCodeExists(slug: string, tableName: string, code: string): Promise<boolean> {
  if (!code) return false;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: tableName,
    columns: "id",
    where: "code = ?",
    params: [code],
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  return rows.length > 0;
}

// GC-XXXX-XXXX-XXXX with the legacy unambiguous alphabet (no O/0, I/1) — GiftCard::generateCode.
function generateGiftcardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number): string => {
    let out = "";
    for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };
  return `GC-${pick(4)}-${pick(4)}-${pick(4)}`;
}

// Default giftcard expiry when the staff leaves "Valida al" blank — port of the legacy
// issueGiftCard auto-expiry: read businesses.giftcard_default_validity_value/_unit
// (days/months/years) and add it to the issue date. Falls back to +365d (~12 months, the
// task default) when the setting is unset/zero or the column is missing. Returns YYYY-MM-DD.
async function defaultGiftcardExpiry(slug: string, issuedAtYmd: string): Promise<string> {
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "businesses",
      columns: "giftcard_default_validity_value, giftcard_default_validity_unit",
      orderBy: "id ASC",
      limit: 1,
    });
    const row = rows[0];
    const value = Math.max(0, Math.floor(Number(row?.giftcard_default_validity_value ?? 0) || 0));
    const unit = String(row?.giftcard_default_validity_unit ?? "days").toLowerCase();
    if (value > 0) {
      if (unit === "months") return addMonthsIso(issuedAtYmd, value);
      if (unit === "years") return addMonthsIso(issuedAtYmd, value * 12);
      return addDaysIso(issuedAtYmd, value);
    }
  } catch {
    // missing column / table -> fall through to the +365d default
  }
  return addDaysIso(issuedAtYmd, 365);
}

// SELL a GiftBox at checkout — faithful port of GiftBox::issueInstance (app/lib/GiftBox.php
// ~2438) for the CORE TEMPLATE sale. Inserts a `giftbox_instances` row OWNED by the recipient
// (recipient_client_id = the chosen recipient, defaulting to the sale buyer — THIS is what
// makes it appear in their residui + lets the drawer's giftbox redeem consume it) with a unique
// GBX-XXXXXX code, status 'issued' (the value the redeem reader treats as available), issued_at,
// expires_at (the custom "Valida al", else the template expires_after_days, else the settings
// default, else +180d), a voucher_public_token, the event/dedica/hide-amount voucher fields, and
// the sale-linkage note ('Vendita #saleId'). Then copies EACH template giftbox_items row into
// giftbox_instance_items (giftbox_item_id = the template item id, item_type/service_id/product_id/
// qty/custom_label) so the redeem reader sees the box contents. Returns the new instance id (0
// when not issued). Optional issue email is OUT OF SCOPE (see TODO). The box PRICE is the line
// price (qty 1) — set as the sale_items line, so the sale TOTAL equals the giftbox price.
async function issueGiftboxFromSale(slug: string, saleId: number, clientId: number, item: PosSaleItem, locationId: number): Promise<number> {
  const instanceTable = await tenantTable(slug, "giftbox_instances").catch(() => null);
  if (!instanceTable) return 0;

  // The chosen giftboxes TEMPLATE (the cart line refId). A giftbox sale always picks a
  // template; without one there are no contents to copy, so skip silently.
  const giftboxId = Math.max(0, Number(item.refId ?? 0) || 0);
  if (giftboxId <= 0) return 0;
  const template = await giftboxTemplateRow(slug, giftboxId);
  if (!template) return 0;

  // Owner = the recipient client the staff picked (defaults to the sale buyer). An instance
  // with no owner cannot show in any residui, so a bench sale with no recipient is skipped.
  const recipientClientId = Math.max(0, Number(item.recipientClientId ?? 0) || 0) || (clientId > 0 ? clientId : 0);
  const hasRecipientColumn = await columnExists(instanceTable.name, "recipient_client_id");
  if (recipientClientId <= 0 && (!item.recipientName || !item.recipientName.trim())) return 0;

  const recipientName = clean(item.recipientName, 120)
    || (recipientClientId > 0 ? await clientName(slug, recipientClientId) : "")
    || "Destinatario";
  const recipientEmail = clean(item.recipientEmail, 190) || null;

  // Unique GBX-XXXXXX code (port of GiftBox::generateCode + the 25-try uniqueness loop).
  const code = await resolveUniqueGiftboxCode(slug, instanceTable.name);

  // EXPIRY: the custom "Valida al" the staff set, else today + the template expires_after_days,
  // else the giftbox settings default (value + unit), else +180d (task fallback). YYYY-MM-DD.
  const issuedAtYmd = todayIso();
  let expiresAt: string | null = item.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresAt) ? item.expiresAt : null;
  if (!expiresAt) {
    const templateDays = Math.max(0, Number(template.expires_after_days ?? 0) || 0);
    if (templateDays > 0) expiresAt = addDaysIso(issuedAtYmd, templateDays);
  }
  if (!expiresAt) expiresAt = await defaultGiftboxExpiry(slug, issuedAtYmd);

  const hideAmount = item.hideAmount === true ? 1 : 0;
  const hasTokenColumn = await columnExists(instanceTable.name, "voucher_public_token");

  const instanceId = await tenantInsert(instanceTable, await filterColumns(instanceTable.name, {
    voucher_public_token: hasTokenColumn ? randomHex(64) : undefined,
    giftbox_id: giftboxId,
    code,
    client_id: clientId > 0 ? clientId : null,
    recipient_client_id: hasRecipientColumn ? (recipientClientId > 0 ? recipientClientId : null) : undefined,
    recipient_name: recipientName,
    recipient_email: recipientEmail,
    event_type: clean(item.eventType, 40) || "giftbox",
    voucher_hide_amount: hideAmount,
    // status 'issued' is what the residui/redeem readers treat as available (NOT 'active').
    status: "issued",
    issued_at: new Date(),
    expires_at: expiresAt,
    points_cost: 0,
    gift_message: clean(item.message, 2000) || null,
    // Sale linkage marker (no sale_id column on giftbox_instances) for the void reversal.
    note: `${GIFTBOX_SALE_MARKER}${saleId}`,
    location_id: locationId > 0 ? locationId : null,
  })).catch(() => 0);
  if (!instanceId) return 0;

  // Copy EACH template giftbox_items row into giftbox_instance_items: the redeem reader keys
  // the per-item residual off giftbox_instance_items.giftbox_item_id (= the template item id),
  // so this is what makes the box redeemable. Best-effort per row (a missing items table is a
  // no-op); a template with no items still issues (an empty but valid voucher).
  const itemsTable = await tenantTable(slug, "giftbox_instance_items").catch(() => null);
  if (itemsTable) {
    const templateItems = await giftboxTemplateItems(slug, giftboxId);
    for (const [index, tplItem] of templateItems.entries()) {
      if (tplItem.giftboxItemId <= 0) continue;
      await tenantInsert(itemsTable, await filterColumns(itemsTable.name, {
        instance_id: instanceId,
        giftbox_item_id: tplItem.giftboxItemId,
        item_type: tplItem.itemType,
        service_id: tplItem.itemType === "service" && tplItem.serviceId > 0 ? tplItem.serviceId : null,
        product_id: tplItem.itemType === "product" && tplItem.productId > 0 ? tplItem.productId : null,
        qty: tplItem.qty,
        custom_label: tplItem.label || null,
        sort_order: index,
      })).catch(() => undefined);
    }
  }

  // TODO: the in-GiftBox custom-build mode (the legacy pos.php issue_giftbox action that builds
  // a one-off giftbox from cart services/products via GiftBox::saveGiftBox before issuing) is
  // OUT OF SCOPE — only the template sale is wired. TODO: the optional issue email (recipient_
  // email / scheduled_send_on) is also out of scope; the giftbox-send cron handles delivery.
  return instanceId;
}

async function giftboxTemplateRow(slug: string, giftboxId: number): Promise<RowDataPacket | null> {
  if (giftboxId <= 0) return null;
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "giftboxes", where: "id=?", params: [giftboxId], limit: 1 }).catch(() => [] as RowDataPacket[]);
  return rows[0] ?? null;
}

// Unique GBX-XXXXXX giftbox instance CODE — port of GiftBox::generateCode (unambiguous
// alphabet, no O/0 or I/1) + the issueInstance 25-try uniqueness loop, mirroring the giftcard
// resolveUniqueGiftcardCode pattern. Codes are generated until one is unused in giftbox_instances.
async function resolveUniqueGiftboxCode(slug: string, tableName: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = generateGiftboxCode();
    if (!(await giftboxCodeExists(slug, tableName, code))) return code;
  }
  // Extremely unlikely fallthrough: append a timestamp suffix to force uniqueness (<= 20 chars).
  return (`GBX-${Date.now().toString(36).toUpperCase()}`).slice(0, 20);
}

async function giftboxCodeExists(slug: string, tableName: string, code: string): Promise<boolean> {
  if (!code) return false;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: tableName,
    columns: "id",
    where: "code = ?",
    params: [code],
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  return rows.length > 0;
}

// GBX-XXXXXX with the legacy unambiguous alphabet (no O/0, I/1) — GiftBox::generateCode.
function generateGiftboxCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `GBX-${out}`;
}

// Default giftbox expiry when the staff leaves "Valida al" blank AND the template has no
// expires_after_days — port of the issueInstance settings fallback: read businesses
// giftbox_default_validity_value/_unit (days/months/years) and add it to the issue date. Falls
// back to +180d (the task default, matching issueDbGiftBox) when unset/zero or the column is
// missing. Returns YYYY-MM-DD.
async function defaultGiftboxExpiry(slug: string, issuedAtYmd: string): Promise<string> {
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "businesses",
      columns: "giftbox_default_validity_value, giftbox_default_validity_unit",
      orderBy: "id ASC",
      limit: 1,
    });
    const row = rows[0];
    const value = Math.max(0, Math.floor(Number(row?.giftbox_default_validity_value ?? 0) || 0));
    const unit = String(row?.giftbox_default_validity_unit ?? "days").toLowerCase();
    if (value > 0) {
      if (unit === "months") return addMonthsIso(issuedAtYmd, value);
      if (unit === "years") return addMonthsIso(issuedAtYmd, value * 12);
      return addDaysIso(issuedAtYmd, value);
    }
  } catch {
    // missing column / table -> fall through to the +180d default
  }
  return addDaysIso(issuedAtYmd, 180);
}

// start-date + N months as YYYY-MM-DD with day clamping (port of GiftCard::addMonthsClamped).
function addMonthsIso(startYmd: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startYmd);
  if (!m) return addDaysIso(startYmd, Math.max(0, months) * 30);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const total = year * 12 + (month - 1) + Math.max(0, Math.floor(months));
  const ny = Math.floor(total / 12);
  const nmo = (total % 12) + 1;
  const dim = new Date(ny, nmo, 0).getDate();
  const nd = Math.min(day, dim);
  return `${ny}-${String(nmo).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

// today/start-date + N days as YYYY-MM-DD (pkAddDurationYmd 'days' base case).
function addDaysIso(startYmd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startYmd);
  const base = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  base.setDate(base.getDate() + Math.max(0, Math.floor(days)));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
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
  if (type === "recharge") return "Ricarica";
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

// Lowercase hex token of `length` chars — used for the giftcard voucher_public_token (a
// 64-char public link/QR token kept separate from the operational code; port of
// GiftCard::generatePublicToken).
function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
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
