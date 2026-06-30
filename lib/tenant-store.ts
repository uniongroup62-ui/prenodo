import {
  appointments as appointmentSeed,
  centerServices,
  clients as clientSeed,
  products as productSeed,
  services as serviceSeed,
  type Client,
  type Product,
  type Service,
} from "@/lib/demo-data";
import type { AppointmentHold, AppointmentWithMeta } from "@/lib/appointment-engine";

export type ManagedClient = Client & {
  id: number;
  email: string;
  phone: string;
  locationId: number;
  tags: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedService = Service & {
  id: number;
  description: string;
  locationIds: number[];
  active: boolean;
  bookingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: number;
  productId: number;
  type: "carico" | "scarico" | "rettifica";
  quantity: number;
  reason: string;
  locationId: number;
  createdAt: string;
};

export type ManagedProduct = Product & {
  sku: string;
  stock: number;
  minStock: number;
  locationId: number;
  publicVisible: boolean;
  movements: StockMovement[];
  createdAt: string;
  updatedAt: string;
};

export type PosSaleItemType = "service" | "product" | "prepaid" | "giftcard" | "package" | "giftbox";
export type PosSaleItemStatus = "executed" | "prepaid" | "collected" | "ordered";
export type PosPaymentMethod = "cash" | "card" | "transfer" | "giftcard" | "wallet";
export type PosSaleStatus = "active" | "cancelled";

export type PosSaleItemInput = {
  type: PosSaleItemType;
  refId?: number;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  status?: PosSaleItemStatus;
  // Package sale meta (faithful to pos.php pkAddRowToCart): the optional custom validity
  // window + note the staff sets in the "Vendi pacchetto" modal. Only read for a
  // type:"package" line; flows through to the issued client_packages row (start_date /
  // expires_at / notes). Ignored for every other line type.
  startDate?: string;
  expiresAt?: string;
  note?: string;
  // GiftCard sale meta (faithful to pos.php issue_giftcard + GiftCard::issueGiftCard):
  // the giftcard configured in the "Emetti GiftCard" modal. Read only for a
  // type:"giftcard" line at checkout; flows through to the issued giftcards row
  // (recipient_client_id / recipient_name / code / expires_at / gift_message /
  // voucher_hide_amount). The card amount is the line unitPrice. Ignored for other types.
  recipientClientId?: number;
  recipientName?: string;
  recipientEmail?: string;
  code?: string;
  eventType?: string;
  message?: string;
  hideAmount?: boolean;
};

export type PosPaymentInput = {
  method: PosPaymentMethod;
  amount: number;
  // For a "giftcard" tender (POS "Residui"): the giftcards.id to consume from, so the
  // checkout can decrement the exact card the staff picked. Ignored for other methods.
  giftcardId?: number;
};

export type PosSaleItem = {
  id: number;
  type: PosSaleItemType;
  refId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: PosSaleItemStatus;
  stockMovementId?: number;
  // Package sale meta carried from the cart to issuePackageFromSale (start/expiry/note).
  startDate?: string;
  expiresAt?: string;
  note?: string;
  // GiftCard sale meta carried from the cart to issueGiftcardFromSale (recipient/code/
  // expiry/dedica/hide-amount). Only set on a type:"giftcard" line.
  recipientClientId?: number;
  recipientName?: string;
  recipientEmail?: string;
  code?: string;
  eventType?: string;
  message?: string;
  hideAmount?: boolean;
};

export type PosPayment = {
  id: number;
  method: PosPaymentMethod;
  amount: number;
  // Set for a "giftcard" tender: the giftcards.id the amount is drawn from.
  giftcardId?: number;
};

export type PosSale = {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  appointmentId?: number;
  locationId: number;
  items: PosSaleItem[];
  payments: PosPayment[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeDue: number;
  status: PosSaleStatus;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  stockCancelMode?: "restore" | "no_restore" | "none";
};

export type PosCheckoutInput = {
  clientId?: number;
  clientName?: string;
  appointmentId?: number;
  locationId?: number;
  discount?: number;
  couponCode?: string;
  notes?: string;
  promotionId?: number;
  installments?: number;
  // FIDELITY redemption: the points the staff wants to spend as a discount at checkout.
  // The backend converts points -> euro discount (points x euro_per_point), validates
  // against the client balance + redeem settings, and consumes them. 0 / undefined = none.
  fidelityPointsUse?: number;
  items: PosSaleItemInput[];
  payments: PosPaymentInput[];
};

export type PosSummary = {
  saleCount: number;
  grossTotal: number;
  activeTotal: number;
  cancelledTotal: number;
  paymentTotals: Record<PosPaymentMethod, number>;
  serviceTotal: number;
  productTotal: number;
};

export type CostStatus = "open" | "paid" | "overdue";
export type CostRecurrence = "none" | "monthly" | "yearly";

export type CostItem = {
  id: number;
  title: string;
  category: string;
  supplier: string;
  amount: number;
  dueDate: string;
  recurrence: CostRecurrence;
  locationId: number;
  status: CostStatus;
  paidAt?: string;
  createdAt: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "converted" | "rejected";

export type QuoteLine = {
  id: number;
  type: PosSaleItemType;
  refId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Quote = {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  status: QuoteStatus;
  publicToken: string;
  expiresAt: string;
  acceptedAt?: string;
  convertedSaleId?: number;
  createdAt: string;
};

export type WalletMovementType = "recharge" | "debit" | "points_earn" | "points_redeem" | "adjustment";

export type WalletMovement = {
  id: number;
  clientId: number;
  type: WalletMovementType;
  amount: number;
  points: number;
  note: string;
  source: string;
  createdAt: string;
};

export type GiftCardStatus = "active" | "used" | "cancelled" | "expired";

export type GiftCard = {
  id: number;
  code: string;
  clientId: number;
  recipientName: string;
  initialAmount: number;
  balance: number;
  status: GiftCardStatus;
  expiresAt: string;
  sourceSaleId?: number;
  createdAt: string;
};

export type NotificationItem = {
  id: number;
  type: "appointment" | "cost" | "quote" | "fidelity" | "system";
  title: string;
  message: string;
  read: boolean;
  link: string;
  createdAt: string;
};

export type AutomationRule = {
  id: number;
  name: string;
  channel: "email" | "sms" | "browser";
  trigger: "appointment_reminder" | "birthday" | "cost_due" | "quote_followup" | "fidelity_expiry";
  enabled: boolean;
  lastRunAt?: string;
  createdAt: string;
};

export type PackageCatalogItem = {
  serviceId: number;
  serviceName: string;
  sessions: number;
};

export type PackageCatalog = {
  id: number;
  name: string;
  price: number;
  items: PackageCatalogItem[];
  active: boolean;
  locationIds: number[];
  createdAt: string;
};

export type ClientPackageStatus = "active" | "completed" | "expired" | "cancelled";

export type ClientPackage = {
  id: number;
  packageId: number;
  clientId: number;
  clientName: string;
  name: string;
  totalSessions: number;
  remainingSessions: number;
  expiresAt?: string;
  status: ClientPackageStatus;
  sourceSaleId?: number;
  createdAt: string;
};

export type ClientPrepaidStatus = "active" | "completed" | "expired" | "cancelled";

export type ClientPrepaid = {
  id: number;
  clientId: number;
  clientName: string;
  serviceId: number;
  serviceName: string;
  totalQuantity: number;
  remainingQuantity: number;
  expiresAt?: string;
  status: ClientPrepaidStatus;
  sourceSaleId?: number;
  createdAt: string;
};

export type PreorderStatus = "open" | "collected" | "cancelled";

export type Preorder = {
  id: number;
  clientId: number;
  clientName: string;
  productId: number;
  productName: string;
  quantity: number;
  deposit: number;
  dueDate: string;
  status: PreorderStatus;
  createdAt: string;
  collectedAt?: string;
};

export type CouponType = "fixed" | "percent";

export type CouponRule = {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  usedCount: number;
  createdAt: string;
};

export type PromotionRule = {
  id: number;
  name: string;
  target: "all" | "new_clients" | "inactive" | "birthday" | "fidelity";
  discountType: CouponType;
  discountValue: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
  channel: "booking" | "pos" | "marketplace";
  createdAt: string;
};

export type GiftBoxStatus = "active" | "redeemed" | "expired" | "cancelled";

export type GiftBoxInstance = {
  id: number;
  code: string;
  clientId: number;
  recipientName: string;
  items: PackageCatalogItem[];
  remainingItems: number;
  status: GiftBoxStatus;
  expiresAt: string;
  sourceSaleId?: number;
  createdAt: string;
};

export type GiftRewardStatus = "available" | "redeemed" | "expired" | "cancelled";

export type GiftReward = {
  id: number;
  clientId: number;
  clientName: string;
  title: string;
  rewardType: "service" | "product" | "discount";
  value: number;
  status: GiftRewardStatus;
  expiresAt: string;
  createdAt: string;
  redeemedAt?: string;
};

export type InstallmentStatus = "due" | "paid" | "overdue";
export type InstallmentPlanStatus = "active" | "completed" | "cancelled";

export type Installment = {
  id: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  paidAt?: string;
};

export type InstallmentPlan = {
  id: number;
  saleId: number;
  clientId: number;
  clientName: string;
  total: number;
  paid: number;
  status: InstallmentPlanStatus;
  installments: Installment[];
  createdAt: string;
};

export type CommissionStatus = "open" | "paid" | "reversed";

export type CommissionEntry = {
  id: number;
  staffName: string;
  saleId?: number;
  appointmentId?: number;
  baseAmount: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt?: string;
};

export type ConfigRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt: string;
};

export type ConfigModuleState = {
  id: string;
  title: string;
  source: string;
  records: ConfigRecord[];
  settings: Record<string, string | number | boolean>;
  updatedAt: string;
};

export type TenantStore = {
  slug: string;
  appointments: AppointmentWithMeta[];
  appointmentHolds: AppointmentHold[];
  clients: ManagedClient[];
  services: ManagedService[];
  products: ManagedProduct[];
  sales: PosSale[];
  costs: CostItem[];
  quotes: Quote[];
  walletMovements: WalletMovement[];
  giftCards: GiftCard[];
  notifications: NotificationItem[];
  automationRules: AutomationRule[];
  packages: PackageCatalog[];
  clientPackages: ClientPackage[];
  prepaids: ClientPrepaid[];
  preorders: Preorder[];
  coupons: CouponRule[];
  promotions: PromotionRule[];
  giftBoxes: GiftBoxInstance[];
  gifts: GiftReward[];
  installmentPlans: InstallmentPlan[];
  commissions: CommissionEntry[];
  configModules: ConfigModuleState[];
  updatedAt: string;
};

type TenantStores = Record<string, TenantStore>;

declare global {
  var __prenodoTenantStores: TenantStores | undefined;
}

export const defaultTenantSlug = "centroesteticoelite";

export function getTenantStore(slug = defaultTenantSlug): TenantStore {
  const normalizedSlug = normalizeTenantStoreSlug(slug);
  globalThis.__prenodoTenantStores ??= {};
  globalThis.__prenodoTenantStores[normalizedSlug] ??= seedTenantStore(normalizedSlug);
  return ensureTenantStoreShape(globalThis.__prenodoTenantStores[normalizedSlug]);
}

export function resetTenantStore(slug = defaultTenantSlug): TenantStore {
  const normalizedSlug = normalizeTenantStoreSlug(slug);
  globalThis.__prenodoTenantStores ??= {};
  globalThis.__prenodoTenantStores[normalizedSlug] = seedTenantStore(normalizedSlug);
  return getTenantStore(normalizedSlug);
}

export function touchStore(store: TenantStore): TenantStore {
  store.updatedAt = new Date().toISOString();
  return store;
}

export function listStoreAppointments(slug = defaultTenantSlug): AppointmentWithMeta[] {
  return getTenantStore(slug).appointments.map((appointment) => ({ ...appointment }));
}

export function replaceStoreAppointments(nextAppointments: AppointmentWithMeta[], slug = defaultTenantSlug): AppointmentWithMeta[] {
  const store = getTenantStore(slug);
  store.appointments = nextAppointments.map((appointment) => ({ ...appointment }));
  touchStore(store);
  return listStoreAppointments(slug);
}

export function appendStoreAppointment(appointment: AppointmentWithMeta, slug = defaultTenantSlug): AppointmentWithMeta[] {
  const store = getTenantStore(slug);
  store.appointments = [...store.appointments, { ...appointment }];
  touchStore(store);
  return listStoreAppointments(slug);
}

export function resetStoreAppointments(slug = defaultTenantSlug): AppointmentWithMeta[] {
  const store = getTenantStore(slug);
  store.appointments = seedAppointments();
  store.appointmentHolds = [];
  touchStore(store);
  return listStoreAppointments(slug);
}

export function listStoreAppointmentHolds(slug = defaultTenantSlug): AppointmentHold[] {
  return getTenantStore(slug).appointmentHolds;
}

export function replaceStoreAppointmentHolds(holds: AppointmentHold[], slug = defaultTenantSlug): AppointmentHold[] {
  const store = getTenantStore(slug);
  store.appointmentHolds = holds;
  touchStore(store);
  return store.appointmentHolds;
}

export function clearStoreAppointmentHolds(slug = defaultTenantSlug): AppointmentHold[] {
  return replaceStoreAppointmentHolds([], slug);
}

export function listClients({
  slug = defaultTenantSlug,
  query = "",
  locationId = 0,
  includeArchived = false,
}: {
  slug?: string;
  query?: string;
  locationId?: number;
  includeArchived?: boolean;
} = {}): ManagedClient[] {
  const normalizedQuery = query.trim().toLowerCase();

  return getTenantStore(slug).clients
    .filter((client) => includeArchived || !client.archived)
    .filter((client) => locationId <= 0 || client.locationId === locationId)
    .filter((client) => {
      if (!normalizedQuery) return true;
      return [client.name, client.email, client.phone, client.note, client.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .map((client) => ({ ...client, tags: [...client.tags] }));
}

export function createClient(input: Partial<ManagedClient>, slug = defaultTenantSlug): ManagedClient {
  const store = getTenantStore(slug);
  const now = new Date().toISOString();
  const client: ManagedClient = {
    id: nextId(store.clients),
    name: normalizeName(input.name, "Nuovo cliente"),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: (input.phone ?? "").trim(),
    locationId: sanitizeLocationId(input.locationId),
    lastVisit: input.lastVisit ?? "Mai",
    value: input.value ?? "0 euro",
    next: input.next ?? "Da pianificare",
    note: input.note ?? "",
    tags: normalizeTags(input.tags),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  store.clients = [...store.clients, client];
  touchStore(store);
  return { ...client, tags: [...client.tags] };
}

export function updateClient(id: number, input: Partial<ManagedClient>, slug = defaultTenantSlug): ManagedClient {
  const store = getTenantStore(slug);
  const existing = store.clients.find((client) => client.id === id);
  if (!existing) throw new Error("Cliente non trovato.");

  const updated: ManagedClient = {
    ...existing,
    ...input,
    id: existing.id,
    name: input.name !== undefined ? normalizeName(input.name, existing.name) : existing.name,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : existing.email,
    phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
    tags: input.tags !== undefined ? normalizeTags(input.tags) : existing.tags,
    locationId: input.locationId !== undefined ? sanitizeLocationId(input.locationId) : existing.locationId,
    updatedAt: new Date().toISOString(),
  };

  store.clients = store.clients.map((client) => (client.id === id ? updated : client));
  touchStore(store);
  return { ...updated, tags: [...updated.tags] };
}

export function archiveClient(id: number, slug = defaultTenantSlug): ManagedClient {
  return updateClient(id, { archived: true, updatedAt: new Date().toISOString() }, slug);
}

export function deleteClient(id: number, slug = defaultTenantSlug): { deleted: boolean; archived: boolean; client: ManagedClient; reason: string } {
  const store = getTenantStore(slug);
  const client = store.clients.find((item) => item.id === id);
  if (!client) throw new Error("Cliente non trovato.");

  const hasAppointments = store.appointments.some((appointment) => samePersonToken(appointment.client) === samePersonToken(client.name));
  if (hasAppointments) {
    const archived = archiveClient(id, slug);
    return {
      deleted: false,
      archived: true,
      client: archived,
      reason: "Cliente archiviato perche collegato ad appuntamenti esistenti.",
    };
  }

  store.clients = store.clients.filter((item) => item.id !== id);
  touchStore(store);
  return {
    deleted: true,
    archived: false,
    client,
    reason: "Cliente eliminato.",
  };
}

export function listServices({
  slug = defaultTenantSlug,
  query = "",
  locationId = 0,
  includeInactive = false,
}: {
  slug?: string;
  query?: string;
  locationId?: number;
  includeInactive?: boolean;
} = {}): ManagedService[] {
  const normalizedQuery = query.trim().toLowerCase();

  return getTenantStore(slug).services
    .filter((service) => includeInactive || service.active)
    .filter((service) => locationId <= 0 || service.locationIds.includes(locationId))
    .filter((service) => {
      if (!normalizedQuery) return true;
      return [service.name, service.category, service.description].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .map(copyService);
}

export function createService(input: Partial<ManagedService>, slug = defaultTenantSlug): ManagedService {
  const store = getTenantStore(slug);
  const now = new Date().toISOString();
  const service: ManagedService = {
    id: nextId(store.services),
    name: normalizeName(input.name, "Nuovo servizio"),
    duration: input.duration ?? "30 min",
    price: input.price ?? "0 euro",
    category: normalizeName(input.category, "Generale"),
    demand: input.demand ?? "0%",
    color: input.color ?? "bg-emerald-100 text-emerald-800",
    description: input.description ?? "",
    locationIds: normalizeLocationIds(input.locationIds),
    active: input.active ?? true,
    bookingEnabled: input.bookingEnabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  store.services = [...store.services, service];
  touchStore(store);
  return copyService(service);
}

export function updateService(id: number, input: Partial<ManagedService>, slug = defaultTenantSlug): ManagedService {
  const store = getTenantStore(slug);
  const existing = store.services.find((service) => service.id === id);
  if (!existing) throw new Error("Servizio non trovato.");

  const updated: ManagedService = {
    ...existing,
    ...input,
    id: existing.id,
    name: input.name !== undefined ? normalizeName(input.name, existing.name) : existing.name,
    category: input.category !== undefined ? normalizeName(input.category, existing.category) : existing.category,
    locationIds: input.locationIds !== undefined ? normalizeLocationIds(input.locationIds) : existing.locationIds,
    updatedAt: new Date().toISOString(),
  };

  store.services = store.services.map((service) => (service.id === id ? updated : service));
  touchStore(store);
  return copyService(updated);
}

export function deleteService(id: number, slug = defaultTenantSlug): { deleted: boolean; deactivated: boolean; service: ManagedService; reason: string } {
  const store = getTenantStore(slug);
  const service = store.services.find((item) => item.id === id);
  if (!service) throw new Error("Servizio non trovato.");

  const hasAppointments = store.appointments.some((appointment) => appointment.service === service.name);
  if (hasAppointments) {
    const deactivated = updateService(id, { active: false, bookingEnabled: false }, slug);
    return {
      deleted: false,
      deactivated: true,
      service: deactivated,
      reason: "Servizio disattivato perche usato da appuntamenti esistenti.",
    };
  }

  store.services = store.services.filter((item) => item.id !== id);
  touchStore(store);
  return {
    deleted: true,
    deactivated: false,
    service,
    reason: "Servizio eliminato.",
  };
}

export function listProducts({
  slug = defaultTenantSlug,
  query = "",
  locationId = 0,
}: {
  slug?: string;
  query?: string;
  locationId?: number;
} = {}): ManagedProduct[] {
  const normalizedQuery = query.trim().toLowerCase();

  return getTenantStore(slug).products
    .filter((product) => locationId <= 0 || product.locationId === locationId)
    .filter((product) => {
      if (!normalizedQuery) return true;
      return [product.name, product.brand, product.category, product.sku].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .map(copyProduct);
}

export function createProduct(input: Partial<ManagedProduct>, slug = defaultTenantSlug): ManagedProduct {
  const store = getTenantStore(slug);
  const now = new Date().toISOString();
  const product: ManagedProduct = {
    id: nextId(store.products),
    name: normalizeName(input.name, "Nuovo prodotto"),
    category: normalizeName(input.category, "Generale"),
    brand: input.brand ?? "",
    price: input.price ?? "0 euro",
    image: input.image ?? "",
    sku: input.sku ?? `SKU-${String(nextId(store.products)).padStart(4, "0")}`,
    stock: Math.max(0, Math.round(input.stock ?? 0)),
    minStock: Math.max(0, Math.round(input.minStock ?? 2)),
    locationId: sanitizeLocationId(input.locationId),
    publicVisible: input.publicVisible ?? false,
    movements: [],
    createdAt: now,
    updatedAt: now,
  };

  if (product.stock > 0) {
    product.movements.push(createStockMovement(product.id, "carico", product.stock, "Giacenza iniziale", product.locationId));
  }

  store.products = [...store.products, product];
  touchStore(store);
  return copyProduct(product);
}

export function updateProduct(id: number, input: Partial<ManagedProduct>, slug = defaultTenantSlug): ManagedProduct {
  const store = getTenantStore(slug);
  const existing = store.products.find((product) => product.id === id);
  if (!existing) throw new Error("Prodotto non trovato.");

  const updated: ManagedProduct = {
    ...existing,
    ...input,
    id: existing.id,
    name: input.name !== undefined ? normalizeName(input.name, existing.name) : existing.name,
    category: input.category !== undefined ? normalizeName(input.category, existing.category) : existing.category,
    stock: input.stock !== undefined ? Math.max(0, Math.round(input.stock)) : existing.stock,
    minStock: input.minStock !== undefined ? Math.max(0, Math.round(input.minStock)) : existing.minStock,
    locationId: input.locationId !== undefined ? sanitizeLocationId(input.locationId) : existing.locationId,
    movements: existing.movements,
    updatedAt: new Date().toISOString(),
  };

  store.products = store.products.map((product) => (product.id === id ? updated : product));
  touchStore(store);
  return copyProduct(updated);
}

export function moveProductStock({
  productId,
  type,
  quantity,
  reason,
  locationId,
  slug = defaultTenantSlug,
}: {
  productId: number;
  type: StockMovement["type"];
  quantity: number;
  reason: string;
  locationId?: number;
  slug?: string;
}): ManagedProduct {
  const store = getTenantStore(slug);
  const product = store.products.find((item) => item.id === productId);
  if (!product) throw new Error("Prodotto non trovato.");

  const movementQuantity = Math.max(0, Math.round(quantity));
  if (movementQuantity <= 0) throw new Error("Quantita non valida.");

  const signedQuantity = type === "scarico" ? -movementQuantity : movementQuantity;
  const nextStock = type === "rettifica" ? movementQuantity : product.stock + signedQuantity;
  if (nextStock < 0) throw new Error("Giacenza insufficiente.");

  const movement = createStockMovement(product.id, type, movementQuantity, reason, locationId ?? product.locationId);
  const updated = {
    ...product,
    stock: nextStock,
    movements: [movement, ...product.movements],
    updatedAt: new Date().toISOString(),
  };

  store.products = store.products.map((item) => (item.id === productId ? updated : item));
  touchStore(store);
  return copyProduct(updated);
}

export function deleteProduct(id: number, slug = defaultTenantSlug): { deleted: boolean; product: ManagedProduct; reason: string } {
  const store = getTenantStore(slug);
  const product = store.products.find((item) => item.id === id);
  if (!product) throw new Error("Prodotto non trovato.");
  if (product.movements.length > 0) {
    throw new Error("Prodotto con movimenti stock: usa disattivazione/visibilita invece dell'eliminazione.");
  }

  store.products = store.products.filter((item) => item.id !== id);
  touchStore(store);
  return { deleted: true, product, reason: "Prodotto eliminato." };
}

export function listSales({
  slug = defaultTenantSlug,
  locationId = 0,
  includeCancelled = true,
}: {
  slug?: string;
  locationId?: number;
  includeCancelled?: boolean;
} = {}): PosSale[] {
  return getTenantStore(slug).sales
    .filter((sale) => includeCancelled || sale.status !== "cancelled")
    .filter((sale) => locationId <= 0 || sale.locationId === locationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(copySale);
}

export function checkoutSale(input: PosCheckoutInput, slug = defaultTenantSlug): PosSale {
  const store = getTenantStore(slug);
  if (!input.items.length) throw new Error("Carrello vuoto.");

  const locationId = sanitizeLocationId(input.locationId);
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const saleId = nextId(store.sales);
  const items = input.items.map((item, index) => buildSaleItem(store, item, index + 1));
  const subtotal = roundMoney(items.reduce((total, item) => total + item.total, 0));
  validateProductStock(store, items);

  const couponPreview = input.couponCode ? previewCoupon(input.couponCode, subtotal, slug) : null;
  const promotionPreview = input.promotionId ? previewPromotion(input.promotionId, subtotal, slug) : null;
  const discount = roundMoney(Math.min(
    subtotal,
    Math.max(0, input.discount ?? 0) +
      (couponPreview?.valid ? couponPreview.discount : 0) +
      (promotionPreview?.valid ? promotionPreview.discount : 0),
  ));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const payments = normalizePayments(input.payments, total);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (paidAmount + 0.00001 < total) throw new Error("Pagamento insufficiente.");
  if (couponPreview?.valid && input.couponCode) redeemCoupon(input.couponCode, subtotal, slug);

  const sale: PosSale = {
    id: saleId,
    code: `S-${String(saleId).padStart(5, "0")}`,
    clientId: client.id,
    clientName: client.name,
    appointmentId: input.appointmentId && input.appointmentId > 0 ? input.appointmentId : undefined,
    locationId,
    items,
    payments,
    subtotal,
    discount,
    total,
    paidAmount,
    changeDue: roundMoney(Math.max(0, paidAmount - total)),
    status: "active",
    createdAt: new Date().toISOString(),
  };

  applyProductStockForSale(store, sale);
  applySpecialSaleItems(slug, sale);
  if (input.installments && input.installments > 1) {
    createInstallmentPlan({ saleId: sale.id, clientId: sale.clientId, clientName: sale.clientName, total: sale.total, count: input.installments }, slug);
  }
  recordCommissionsForSale(store, sale);
  applyClientSaleValue(store, sale.clientId, sale.total);
  if (sale.appointmentId) completeSaleAppointment(store, sale.appointmentId);

  store.sales = [...store.sales, sale];
  touchStore(store);
  return copySale(sale);
}

export function cancelSale({
  saleId,
  reason,
  stockCancelMode = "restore",
  slug = defaultTenantSlug,
}: {
  saleId: number;
  reason: string;
  stockCancelMode?: "restore" | "no_restore" | "none";
  slug?: string;
}): PosSale {
  const store = getTenantStore(slug);
  const sale = store.sales.find((item) => item.id === saleId);
  if (!sale) throw new Error("Vendita non trovata.");
  if (sale.status === "cancelled") throw new Error("Vendita gia annullata.");

  const mode = normalizeStockCancelMode(stockCancelMode, sale);
  if (mode === "restore") restoreProductStockForSale(store, sale);
  rollbackSpecialSaleItems(store, sale);
  reverseCommissionsForSale(store, sale);
  if (sale.clientId > 0) applyClientSaleValue(store, sale.clientId, -sale.total);
  if (sale.appointmentId) reopenSaleAppointment(store, sale.appointmentId);

  const cancelled: PosSale = {
    ...sale,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason.trim() || "Annullamento vendita",
    stockCancelMode: mode,
  };

  store.sales = store.sales.map((item) => (item.id === saleId ? cancelled : item));
  touchStore(store);
  return copySale(cancelled);
}

export function posSummary(slug = defaultTenantSlug): PosSummary {
  const activeSales = getTenantStore(slug).sales.filter((sale) => sale.status !== "cancelled");
  const cancelledSales = getTenantStore(slug).sales.filter((sale) => sale.status === "cancelled");
  const paymentTotals: Record<PosPaymentMethod, number> = {
    cash: 0,
    card: 0,
    transfer: 0,
    giftcard: 0,
    wallet: 0,
  };
  let serviceTotal = 0;
  let productTotal = 0;

  for (const sale of activeSales) {
    for (const payment of sale.payments) {
      paymentTotals[payment.method] = roundMoney(paymentTotals[payment.method] + payment.amount);
    }
    for (const item of sale.items) {
      if (item.type === "service") serviceTotal = roundMoney(serviceTotal + item.total);
      if (item.type === "product") productTotal = roundMoney(productTotal + item.total);
    }
  }

  return {
    saleCount: activeSales.length,
    grossTotal: roundMoney(getTenantStore(slug).sales.reduce((total, sale) => total + sale.total, 0)),
    activeTotal: roundMoney(activeSales.reduce((total, sale) => total + sale.total, 0)),
    cancelledTotal: roundMoney(cancelledSales.reduce((total, sale) => total + sale.total, 0)),
    paymentTotals,
    serviceTotal,
    productTotal,
  };
}

export function listCosts(slug = defaultTenantSlug): CostItem[] {
  refreshCostStatuses(slug);
  return getTenantStore(slug).costs.map((cost) => ({ ...cost })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function createCost(input: Partial<CostItem>, slug = defaultTenantSlug): CostItem {
  const store = getTenantStore(slug);
  const cost: CostItem = {
    id: nextId(store.costs),
    title: normalizeName(input.title, "Nuovo costo"),
    category: normalizeName(input.category, "Generale"),
    supplier: input.supplier?.trim() || "Fornitore",
    amount: roundMoney(Math.max(0, input.amount ?? 0)),
    dueDate: normalizeDate(input.dueDate, todayIso()),
    recurrence: input.recurrence ?? "none",
    locationId: sanitizeLocationId(input.locationId),
    status: "open",
    createdAt: new Date().toISOString(),
  };

  cost.status = statusForCost(cost);
  store.costs = [...store.costs, cost];
  notify(store, "cost", "Nuova scadenza", `${cost.title} - ${cost.amount} euro`, "costs");
  touchStore(store);
  return { ...cost };
}

export function markCostPaid(id: number, slug = defaultTenantSlug): CostItem {
  const store = getTenantStore(slug);
  const cost = store.costs.find((item) => item.id === id);
  if (!cost) throw new Error("Costo non trovato.");

  const paid: CostItem = {
    ...cost,
    status: "paid",
    paidAt: new Date().toISOString(),
  };

  store.costs = store.costs.map((item) => (item.id === id ? paid : item));

  if (paid.recurrence !== "none") {
    const nextCost = {
      ...paid,
      id: nextId(store.costs),
      dueDate: nextRecurringDate(paid.dueDate, paid.recurrence),
      status: "open" as CostStatus,
      paidAt: undefined,
      createdAt: new Date().toISOString(),
    };
    store.costs.push(nextCost);
  }

  touchStore(store);
  return { ...paid };
}

export function costSummary(slug = defaultTenantSlug): { open: number; overdue: number; paid: number; dueAmount: number } {
  const costs = listCosts(slug);
  return {
    open: costs.filter((cost) => cost.status === "open").length,
    overdue: costs.filter((cost) => cost.status === "overdue").length,
    paid: costs.filter((cost) => cost.status === "paid").length,
    dueAmount: roundMoney(costs.filter((cost) => cost.status !== "paid").reduce((total, cost) => total + cost.amount, 0)),
  };
}

export function listQuotes(slug = defaultTenantSlug): Quote[] {
  return getTenantStore(slug).quotes.map(copyQuote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createQuote(input: { clientId?: number; clientName?: string; lines: PosSaleItemInput[]; discount?: number }, slug = defaultTenantSlug): Quote {
  const store = getTenantStore(slug);
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const quoteId = nextId(store.quotes);
  const lines = input.lines.map((line, index) => {
    const saleItem = buildSaleItem(store, line, index + 1);
    return {
      id: saleItem.id,
      type: saleItem.type,
      refId: saleItem.refId,
      name: saleItem.name,
      quantity: saleItem.quantity,
      unitPrice: saleItem.unitPrice,
      total: saleItem.total,
    };
  });
  const subtotal = roundMoney(lines.reduce((total, line) => total + line.total, 0));
  const discount = roundMoney(Math.max(0, input.discount ?? 0));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const quote: Quote = {
    id: quoteId,
    code: `Q-${String(quoteId).padStart(5, "0")}`,
    clientId: client.id,
    clientName: client.name,
    lines,
    subtotal,
    discount,
    total,
    status: "draft",
    publicToken: randomCode("qt"),
    expiresAt: addDaysIso(30),
    createdAt: new Date().toISOString(),
  };

  store.quotes = [...store.quotes, quote];
  notify(store, "quote", "Preventivo creato", `${quote.code} - ${quote.clientName}`, "quotes");
  touchStore(store);
  return copyQuote(quote);
}

export function sendQuote(id: number, slug = defaultTenantSlug): Quote {
  return updateQuoteStatus(id, "sent", slug);
}

export function acceptQuote(id: number, slug = defaultTenantSlug): Quote {
  const store = getTenantStore(slug);
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) throw new Error("Preventivo non trovato.");
  const accepted = { ...quote, status: "accepted" as QuoteStatus, acceptedAt: new Date().toISOString() };
  store.quotes = store.quotes.map((item) => (item.id === id ? accepted : item));
  notify(store, "quote", "Preventivo accettato", `${accepted.code} pronto per conversione`, "quotes");
  touchStore(store);
  return copyQuote(accepted);
}

export function convertQuoteToSale(id: number, slug = defaultTenantSlug): { quote: Quote; sale: PosSale } {
  const store = getTenantStore(slug);
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) throw new Error("Preventivo non trovato.");
  if (quote.status === "converted") throw new Error("Preventivo gia convertito.");
  const sale = checkoutSale({
    clientId: quote.clientId,
    clientName: quote.clientName,
    locationId: 1,
    discount: quote.discount,
    items: quote.lines.map((line) => ({
      type: line.type,
      refId: line.refId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    payments: [{ method: "card", amount: quote.total }],
  }, slug);
  const converted = { ...quote, status: "converted" as QuoteStatus, convertedSaleId: sale.id };
  getTenantStore(slug).quotes = getTenantStore(slug).quotes.map((item) => (item.id === id ? converted : item));
  touchStore(getTenantStore(slug));
  return { quote: copyQuote(converted), sale };
}

export function listWalletMovements(slug = defaultTenantSlug): WalletMovement[] {
  return getTenantStore(slug).walletMovements.map((movement) => ({ ...movement })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function walletBalance(clientId: number, slug = defaultTenantSlug): { credit: number; points: number } {
  const movements = getTenantStore(slug).walletMovements.filter((movement) => movement.clientId === clientId);
  return {
    credit: roundMoney(movements.reduce((total, movement) => total + movement.amount, 0)),
    points: Math.round(movements.reduce((total, movement) => total + movement.points, 0)),
  };
}

export function addWalletMovement(input: Partial<WalletMovement>, slug = defaultTenantSlug): WalletMovement {
  const store = getTenantStore(slug);
  const movement: WalletMovement = {
    id: nextId(store.walletMovements),
    clientId: Math.max(0, input.clientId ?? 0),
    type: input.type ?? "adjustment",
    amount: roundMoney(input.amount ?? 0),
    points: Math.round(input.points ?? 0),
    note: input.note?.trim() || "Movimento wallet",
    source: input.source?.trim() || "manual",
    createdAt: new Date().toISOString(),
  };

  store.walletMovements = [movement, ...store.walletMovements];
  notify(store, "fidelity", "Wallet aggiornato", movement.note, "wallet");
  touchStore(store);
  return { ...movement };
}

export function listGiftCards(slug = defaultTenantSlug): GiftCard[] {
  refreshGiftCardStatuses(slug);
  return getTenantStore(slug).giftCards.map((giftCard) => ({ ...giftCard })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function issueGiftCard(input: Partial<GiftCard>, slug = defaultTenantSlug): GiftCard {
  const store = getTenantStore(slug);
  const amount = roundMoney(Math.max(0, input.initialAmount ?? input.balance ?? 0));
  if (amount <= 0) throw new Error("Importo GiftCard non valido.");
  const giftCard: GiftCard = {
    id: nextId(store.giftCards),
    code: input.code?.trim().toUpperCase() || randomCode("GC").toUpperCase(),
    clientId: Math.max(0, input.clientId ?? 0),
    recipientName: input.recipientName?.trim() || "Destinatario",
    initialAmount: amount,
    balance: amount,
    status: "active",
    expiresAt: input.expiresAt ?? addDaysIso(365),
    sourceSaleId: input.sourceSaleId,
    createdAt: new Date().toISOString(),
  };

  store.giftCards = [giftCard, ...store.giftCards];
  notify(store, "fidelity", "GiftCard emessa", `${giftCard.code} - ${giftCard.initialAmount} euro`, "giftcard");
  touchStore(store);
  return { ...giftCard };
}

export function redeemGiftCard(id: number, amount: number, slug = defaultTenantSlug): GiftCard {
  const store = getTenantStore(slug);
  const giftCard = store.giftCards.find((item) => item.id === id);
  if (!giftCard) throw new Error("GiftCard non trovata.");
  if (giftCard.status !== "active") throw new Error("GiftCard non utilizzabile.");
  const value = roundMoney(Math.max(0, amount));
  if (value <= 0 || value > giftCard.balance) throw new Error("Importo riscatto non valido.");
  const redeemed = {
    ...giftCard,
    balance: roundMoney(giftCard.balance - value),
    status: roundMoney(giftCard.balance - value) <= 0 ? "used" as GiftCardStatus : "active" as GiftCardStatus,
  };
  store.giftCards = store.giftCards.map((item) => (item.id === id ? redeemed : item));
  touchStore(store);
  return { ...redeemed };
}

export function listNotifications(slug = defaultTenantSlug): NotificationItem[] {
  generateDerivedNotifications(slug);
  return getTenantStore(slug).notifications.map((notification) => ({ ...notification })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: number, slug = defaultTenantSlug): NotificationItem {
  const store = getTenantStore(slug);
  const notification = store.notifications.find((item) => item.id === id);
  if (!notification) throw new Error("Notifica non trovata.");
  const read = { ...notification, read: true };
  store.notifications = store.notifications.map((item) => (item.id === id ? read : item));
  touchStore(store);
  return { ...read };
}

export function listAutomationRules(slug = defaultTenantSlug): AutomationRule[] {
  return getTenantStore(slug).automationRules.map((rule) => ({ ...rule }));
}

export function toggleAutomationRule(id: number, enabled: boolean, slug = defaultTenantSlug): AutomationRule {
  const store = getTenantStore(slug);
  const rule = store.automationRules.find((item) => item.id === id);
  if (!rule) throw new Error("Automazione non trovata.");
  const updated = { ...rule, enabled };
  store.automationRules = store.automationRules.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { ...updated };
}

export function runAutomationRule(id: number, slug = defaultTenantSlug): { rule: AutomationRule; notifications: NotificationItem[] } {
  const store = getTenantStore(slug);
  const rule = store.automationRules.find((item) => item.id === id);
  if (!rule) throw new Error("Automazione non trovata.");
  if (!rule.enabled) throw new Error("Automazione disattivata.");
  const notification = notify(store, "system", "Automazione eseguita", rule.name, "automation");
  const updated = { ...rule, lastRunAt: new Date().toISOString() };
  store.automationRules = store.automationRules.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { rule: { ...updated }, notifications: [notification] };
}

export function listPackageState(slug = defaultTenantSlug): { catalog: PackageCatalog[]; clientPackages: ClientPackage[] } {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  return {
    catalog: store.packages.map(copyPackageCatalog),
    clientPackages: store.clientPackages.map((item) => ({ ...item })),
  };
}

export function issueClientPackage(input: { packageId?: number; clientId?: number; clientName?: string; expiresAt?: string; sourceSaleId?: number }, slug = defaultTenantSlug): ClientPackage {
  const store = getTenantStore(slug);
  const catalog = store.packages.find((item) => item.id === input.packageId && item.active) ?? store.packages.find((item) => item.active);
  if (!catalog) throw new Error("Pacchetto non trovato.");
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const totalSessions = catalog.items.reduce((total, item) => total + item.sessions, 0);
  const clientPackage: ClientPackage = {
    id: nextId(store.clientPackages),
    packageId: catalog.id,
    clientId: client.id,
    clientName: client.name,
    name: catalog.name,
    totalSessions,
    remainingSessions: totalSessions,
    expiresAt: input.expiresAt ?? addDaysIso(180),
    status: "active",
    sourceSaleId: input.sourceSaleId,
    createdAt: new Date().toISOString(),
  };

  store.clientPackages = [clientPackage, ...store.clientPackages];
  notify(store, "fidelity", "Pacchetto emesso", `${clientPackage.name} - ${clientPackage.clientName}`, "packages");
  touchStore(store);
  return { ...clientPackage };
}

export function consumeClientPackage(id: number, sessions = 1, slug = defaultTenantSlug): ClientPackage {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  const current = store.clientPackages.find((item) => item.id === id);
  if (!current) throw new Error("Pacchetto cliente non trovato.");
  if (current.status !== "active") throw new Error("Pacchetto non utilizzabile.");
  const quantity = Math.max(1, Math.round(sessions));
  if (current.remainingSessions < quantity) throw new Error("Sedute pacchetto insufficienti.");
  const remainingSessions = current.remainingSessions - quantity;
  const updated: ClientPackage = {
    ...current,
    remainingSessions,
    status: remainingSessions <= 0 ? "completed" : "active",
  };
  store.clientPackages = store.clientPackages.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { ...updated };
}

export function listPrepaids(slug = defaultTenantSlug): ClientPrepaid[] {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  return store.prepaids.map((item) => ({ ...item }));
}

export function issuePrepaid(input: { clientId?: number; clientName?: string; serviceId?: number; quantity?: number; expiresAt?: string; sourceSaleId?: number }, slug = defaultTenantSlug): ClientPrepaid {
  const store = getTenantStore(slug);
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const service = store.services.find((item) => item.id === input.serviceId) ?? store.services[0];
  if (!service) throw new Error("Servizio prepagato non trovato.");
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const prepaid: ClientPrepaid = {
    id: nextId(store.prepaids),
    clientId: client.id,
    clientName: client.name,
    serviceId: service.id,
    serviceName: service.name,
    totalQuantity: quantity,
    remainingQuantity: quantity,
    expiresAt: input.expiresAt ?? addDaysIso(120),
    status: "active",
    sourceSaleId: input.sourceSaleId,
    createdAt: new Date().toISOString(),
  };

  store.prepaids = [prepaid, ...store.prepaids];
  notify(store, "fidelity", "Prepagato emesso", `${prepaid.serviceName} - ${prepaid.clientName}`, "pos_prepaids");
  touchStore(store);
  return { ...prepaid };
}

export function consumePrepaid(id: number, quantity = 1, slug = defaultTenantSlug): ClientPrepaid {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  const current = store.prepaids.find((item) => item.id === id);
  if (!current) throw new Error("Prepagato non trovato.");
  if (current.status !== "active") throw new Error("Prepagato non utilizzabile.");
  const usedQuantity = Math.max(1, Math.round(quantity));
  if (current.remainingQuantity < usedQuantity) throw new Error("Residuo prepagato insufficiente.");
  const remainingQuantity = current.remainingQuantity - usedQuantity;
  const updated: ClientPrepaid = {
    ...current,
    remainingQuantity,
    status: remainingQuantity <= 0 ? "completed" : "active",
  };
  store.prepaids = store.prepaids.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { ...updated };
}

export function listPreorders(slug = defaultTenantSlug): Preorder[] {
  return getTenantStore(slug).preorders.map((item) => ({ ...item })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPreorder(input: { clientId?: number; clientName?: string; productId?: number; quantity?: number; deposit?: number; dueDate?: string }, slug = defaultTenantSlug): Preorder {
  const store = getTenantStore(slug);
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const product = store.products.find((item) => item.id === input.productId) ?? store.products[0];
  if (!product) throw new Error("Prodotto preordine non trovato.");
  const preorder: Preorder = {
    id: nextId(store.preorders),
    clientId: client.id,
    clientName: client.name,
    productId: product.id,
    productName: product.name,
    quantity: Math.max(1, Math.round(input.quantity ?? 1)),
    deposit: roundMoney(Math.max(0, input.deposit ?? 0)),
    dueDate: normalizeDate(input.dueDate, addDaysIso(14)),
    status: "open",
    createdAt: new Date().toISOString(),
  };

  store.preorders = [preorder, ...store.preorders];
  notify(store, "system", "Preordine creato", `${preorder.productName} - ${preorder.clientName}`, "pos_preorders");
  touchStore(store);
  return { ...preorder };
}

export function collectPreorder(id: number, slug = defaultTenantSlug): Preorder {
  const store = getTenantStore(slug);
  const preorder = store.preorders.find((item) => item.id === id);
  if (!preorder) throw new Error("Preordine non trovato.");
  if (preorder.status !== "open") throw new Error("Preordine non ritirabile.");
  const product = store.products.find((item) => item.id === preorder.productId);
  if (product && product.stock < preorder.quantity) throw new Error("Giacenza insufficiente per ritiro preordine.");
  if (product) {
    moveProductStock({
      productId: product.id,
      type: "scarico",
      quantity: preorder.quantity,
      reason: `Ritiro preordine ${preorder.id}`,
      locationId: product.locationId,
      slug,
    });
  }
  const collected: Preorder = { ...preorder, status: "collected", collectedAt: new Date().toISOString() };
  getTenantStore(slug).preorders = getTenantStore(slug).preorders.map((item) => (item.id === id ? collected : item));
  touchStore(getTenantStore(slug));
  return { ...collected };
}

export function listCoupons(slug = defaultTenantSlug): CouponRule[] {
  return getTenantStore(slug).coupons.map((coupon) => ({ ...coupon })).sort((a, b) => a.code.localeCompare(b.code));
}

export function createCoupon(input: Partial<CouponRule>, slug = defaultTenantSlug): CouponRule {
  const store = getTenantStore(slug);
  const coupon: CouponRule = {
    id: nextId(store.coupons),
    code: normalizeCouponCode(input.code ?? randomCode("coupon")),
    type: input.type ?? "fixed",
    value: roundMoney(Math.max(0, input.value ?? 0)),
    minSubtotal: roundMoney(Math.max(0, input.minSubtotal ?? 0)),
    active: input.active ?? true,
    startsAt: normalizeDate(input.startsAt, todayIso()),
    endsAt: normalizeDate(input.endsAt, addDaysIso(30)),
    usageLimit: Math.max(1, Math.round(input.usageLimit ?? 100)),
    usedCount: Math.max(0, Math.round(input.usedCount ?? 0)),
    createdAt: new Date().toISOString(),
  };
  if (store.coupons.some((item) => item.code === coupon.code)) throw new Error("Coupon gia esistente.");
  store.coupons = [coupon, ...store.coupons];
  touchStore(store);
  return { ...coupon };
}

export function previewCoupon(code: string, subtotal: number, slug = defaultTenantSlug): { valid: boolean; discount: number; reason: string; coupon?: CouponRule } {
  const coupon = getTenantStore(slug).coupons.find((item) => item.code === normalizeCouponCode(code));
  if (!coupon) return { valid: false, discount: 0, reason: "Coupon non trovato." };
  const activeCheck = activeWindow(coupon.startsAt, coupon.endsAt);
  if (!coupon.active || !activeCheck) return { valid: false, discount: 0, reason: "Coupon non attivo.", coupon: { ...coupon } };
  if (coupon.usedCount >= coupon.usageLimit) return { valid: false, discount: 0, reason: "Coupon esaurito.", coupon: { ...coupon } };
  if (subtotal < coupon.minSubtotal) return { valid: false, discount: 0, reason: "Minimo carrello non raggiunto.", coupon: { ...coupon } };
  return { valid: true, discount: discountValue(coupon.type, coupon.value, subtotal), reason: "Coupon valido.", coupon: { ...coupon } };
}

export function redeemCoupon(code: string, subtotal: number, slug = defaultTenantSlug): { coupon: CouponRule; discount: number } {
  const preview = previewCoupon(code, subtotal, slug);
  if (!preview.valid || !preview.coupon) throw new Error(preview.reason);
  const store = getTenantStore(slug);
  const updated = { ...preview.coupon, usedCount: preview.coupon.usedCount + 1 };
  store.coupons = store.coupons.map((item) => (item.id === updated.id ? updated : item));
  touchStore(store);
  return { coupon: { ...updated }, discount: preview.discount };
}

export function listPromotions(slug = defaultTenantSlug): PromotionRule[] {
  return getTenantStore(slug).promotions.map((promotion) => ({ ...promotion })).sort((a, b) => a.name.localeCompare(b.name));
}

export function togglePromotion(id: number, active: boolean, slug = defaultTenantSlug): PromotionRule {
  const store = getTenantStore(slug);
  const promotion = store.promotions.find((item) => item.id === id);
  if (!promotion) throw new Error("Promozione non trovata.");
  const updated = { ...promotion, active };
  store.promotions = store.promotions.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { ...updated };
}

export function previewPromotion(id: number, subtotal: number, slug = defaultTenantSlug): { valid: boolean; discount: number; reason: string; promotion?: PromotionRule } {
  const promotion = getTenantStore(slug).promotions.find((item) => item.id === id);
  if (!promotion) return { valid: false, discount: 0, reason: "Promozione non trovata." };
  if (!promotion.active || !activeWindow(promotion.startsAt, promotion.endsAt)) {
    return { valid: false, discount: 0, reason: "Promozione non attiva.", promotion: { ...promotion } };
  }
  return {
    valid: true,
    discount: discountValue(promotion.discountType, promotion.discountValue, subtotal),
    reason: "Promozione valida.",
    promotion: { ...promotion },
  };
}

export function listGiftBoxes(slug = defaultTenantSlug): GiftBoxInstance[] {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  return store.giftBoxes.map((giftBox) => ({ ...giftBox, items: giftBox.items.map((item) => ({ ...item })) }));
}

export function issueGiftBox(input: { clientId?: number; recipientName?: string; serviceId?: number; sessions?: number; expiresAt?: string; sourceSaleId?: number }, slug = defaultTenantSlug): GiftBoxInstance {
  const store = getTenantStore(slug);
  const service = store.services.find((item) => item.id === input.serviceId) ?? store.services[0];
  if (!service) throw new Error("Servizio GiftBox non trovato.");
  const sessions = Math.max(1, Math.round(input.sessions ?? 1));
  const giftBox: GiftBoxInstance = {
    id: nextId(store.giftBoxes),
    code: randomCode("GB").toUpperCase(),
    clientId: Math.max(0, input.clientId ?? 0),
    recipientName: input.recipientName?.trim() || "Destinatario",
    items: [{ serviceId: service.id, serviceName: service.name, sessions }],
    remainingItems: sessions,
    status: "active",
    expiresAt: normalizeDate(input.expiresAt, addDaysIso(180)),
    sourceSaleId: input.sourceSaleId,
    createdAt: new Date().toISOString(),
  };
  store.giftBoxes = [giftBox, ...store.giftBoxes];
  notify(store, "fidelity", "GiftBox emessa", `${giftBox.code} - ${giftBox.recipientName}`, "giftbox");
  touchStore(store);
  return { ...giftBox, items: giftBox.items.map((item) => ({ ...item })) };
}

export function redeemGiftBox(id: number, quantity = 1, slug = defaultTenantSlug): GiftBoxInstance {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  const giftBox = store.giftBoxes.find((item) => item.id === id);
  if (!giftBox) throw new Error("GiftBox non trovata.");
  if (giftBox.status !== "active") throw new Error("GiftBox non utilizzabile.");
  const usedQuantity = Math.max(1, Math.round(quantity));
  if (giftBox.remainingItems < usedQuantity) throw new Error("Residuo GiftBox insufficiente.");
  const remainingItems = giftBox.remainingItems - usedQuantity;
  const updated: GiftBoxInstance = {
    ...giftBox,
    remainingItems,
    status: remainingItems <= 0 ? "redeemed" : "active",
  };
  store.giftBoxes = store.giftBoxes.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return { ...updated, items: updated.items.map((item) => ({ ...item })) };
}

export function listGifts(slug = defaultTenantSlug): GiftReward[] {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  return store.gifts.map((gift) => ({ ...gift }));
}

export function issueGift(input: { clientId?: number; clientName?: string; title?: string; rewardType?: GiftReward["rewardType"]; value?: number; expiresAt?: string }, slug = defaultTenantSlug): GiftReward {
  const store = getTenantStore(slug);
  const client = resolveSaleClient(store, input.clientId, input.clientName);
  const gift: GiftReward = {
    id: nextId(store.gifts),
    clientId: client.id,
    clientName: client.name,
    title: input.title?.trim() || "Omaggi manuale",
    rewardType: input.rewardType ?? "discount",
    value: roundMoney(Math.max(0, input.value ?? 0)),
    status: "available",
    expiresAt: normalizeDate(input.expiresAt, addDaysIso(60)),
    createdAt: new Date().toISOString(),
  };
  store.gifts = [gift, ...store.gifts];
  notify(store, "fidelity", "Omaggi emesso", `${gift.title} - ${gift.clientName}`, "gifts");
  touchStore(store);
  return { ...gift };
}

export function redeemGift(id: number, slug = defaultTenantSlug): GiftReward {
  const store = getTenantStore(slug);
  refreshResidualStatuses(store);
  const gift = store.gifts.find((item) => item.id === id);
  if (!gift) throw new Error("Omaggi non trovato.");
  if (gift.status !== "available") throw new Error("Omaggi non riscattabile.");
  const redeemed: GiftReward = { ...gift, status: "redeemed", redeemedAt: new Date().toISOString() };
  store.gifts = store.gifts.map((item) => (item.id === id ? redeemed : item));
  touchStore(store);
  return { ...redeemed };
}

export function listInstallmentPlans(slug = defaultTenantSlug): InstallmentPlan[] {
  const store = getTenantStore(slug);
  refreshInstallmentStatuses(store);
  return store.installmentPlans.map(copyInstallmentPlan).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createInstallmentPlan(input: { saleId?: number; clientId?: number; clientName?: string; total?: number; count?: number }, slug = defaultTenantSlug): InstallmentPlan {
  const store = getTenantStore(slug);
  const sale = input.saleId ? store.sales.find((item) => item.id === input.saleId) : undefined;
  const client = resolveSaleClient(store, input.clientId ?? sale?.clientId, input.clientName ?? sale?.clientName);
  const total = roundMoney(Math.max(1, input.total ?? sale?.total ?? 0));
  const count = Math.max(1, Math.round(input.count ?? 3));
  const amount = roundMoney(total / count);
  const installments = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    dueDate: addDaysIso(30 * (index + 1)),
    amount: index === count - 1 ? roundMoney(total - amount * (count - 1)) : amount,
    status: "due" as InstallmentStatus,
  }));
  const plan: InstallmentPlan = {
    id: nextId(store.installmentPlans),
    saleId: sale?.id ?? input.saleId ?? 0,
    clientId: client.id,
    clientName: client.name,
    total,
    paid: 0,
    status: "active",
    installments,
    createdAt: new Date().toISOString(),
  };

  store.installmentPlans = [plan, ...store.installmentPlans];
  notify(store, "system", "Piano rateale creato", `${client.name} - ${total} euro`, "installments_manage");
  touchStore(store);
  return copyInstallmentPlan(plan);
}

export function payInstallment(planId: number, installmentId: number, slug = defaultTenantSlug): InstallmentPlan {
  const store = getTenantStore(slug);
  refreshInstallmentStatuses(store);
  const plan = store.installmentPlans.find((item) => item.id === planId);
  if (!plan) throw new Error("Piano rateale non trovato.");
  const installment = plan.installments.find((item) => item.id === installmentId);
  if (!installment) throw new Error("Rata non trovata.");
  if (installment.status === "paid") throw new Error("Rata gia pagata.");
  const installments = plan.installments.map((item) =>
    item.id === installmentId ? { ...item, status: "paid" as InstallmentStatus, paidAt: new Date().toISOString() } : item,
  );
  const paid = roundMoney(installments.filter((item) => item.status === "paid").reduce((total, item) => total + item.amount, 0));
  const updated: InstallmentPlan = {
    ...plan,
    paid,
    installments,
    status: paid + 0.00001 >= plan.total ? "completed" : "active",
  };
  store.installmentPlans = store.installmentPlans.map((item) => (item.id === planId ? updated : item));
  touchStore(store);
  return copyInstallmentPlan(updated);
}

export function listCommissions(slug = defaultTenantSlug): CommissionEntry[] {
  return getTenantStore(slug).commissions.map((commission) => ({ ...commission })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function commissionSummary(slug = defaultTenantSlug): { open: number; paid: number; reversed: number; dueAmount: number } {
  const commissions = listCommissions(slug);
  return {
    open: commissions.filter((commission) => commission.status === "open").length,
    paid: commissions.filter((commission) => commission.status === "paid").length,
    reversed: commissions.filter((commission) => commission.status === "reversed").length,
    dueAmount: roundMoney(commissions.filter((commission) => commission.status === "open").reduce((total, commission) => total + commission.amount, 0)),
  };
}

export function markCommissionPaid(id: number, slug = defaultTenantSlug): CommissionEntry {
  const store = getTenantStore(slug);
  const commission = store.commissions.find((item) => item.id === id);
  if (!commission) throw new Error("Commissione non trovata.");
  if (commission.status !== "open") throw new Error("Commissione non liquidabile.");
  const paid = { ...commission, status: "paid" as CommissionStatus, paidAt: new Date().toISOString() };
  store.commissions = store.commissions.map((item) => (item.id === id ? paid : item));
  touchStore(store);
  return { ...paid };
}

export function listConfigModule(moduleId: string, slug = defaultTenantSlug): ConfigModuleState {
  const store = getTenantStore(slug);
  const normalizedId = normalizeConfigModuleId(moduleId);
  const moduleState = store.configModules.find((moduleItem) => moduleItem.id === normalizedId) ?? createFallbackConfigModule(normalizedId);
  if (!store.configModules.some((moduleItem) => moduleItem.id === normalizedId)) {
    store.configModules = [...store.configModules, moduleState];
    touchStore(store);
  }
  return copyConfigModule(moduleState);
}

export function toggleConfigRecord(moduleId: string, recordId: number, active: boolean, slug = defaultTenantSlug): ConfigModuleState {
  const store = getTenantStore(slug);
  const normalizedId = normalizeConfigModuleId(moduleId);
  const moduleState = store.configModules.find((item) => item.id === normalizedId) ?? createFallbackConfigModule(normalizedId);
  const records = moduleState.records.map((record) =>
    record.id === recordId ? { ...record, active, updatedAt: new Date().toISOString() } : record,
  );
  const updated = { ...moduleState, records, updatedAt: new Date().toISOString() };
  store.configModules = upsertConfigModule(store.configModules, updated);
  touchStore(store);
  return copyConfigModule(updated);
}

export function touchConfigModule(moduleId: string, slug = defaultTenantSlug): ConfigModuleState {
  const store = getTenantStore(slug);
  const normalizedId = normalizeConfigModuleId(moduleId);
  const moduleState = store.configModules.find((item) => item.id === normalizedId) ?? createFallbackConfigModule(normalizedId);
  const updatedRecord: ConfigRecord = {
    id: nextId(moduleState.records),
    module: normalizedId,
    title: "Aggiornamento demo",
    detail: "Azione rapida eseguita dalla replica Next",
    value: todayIso(),
    active: true,
    updatedAt: new Date().toISOString(),
  };
  const updated = {
    ...moduleState,
    records: [updatedRecord, ...moduleState.records].slice(0, 6),
    updatedAt: new Date().toISOString(),
  };
  store.configModules = upsertConfigModule(store.configModules, updated);
  touchStore(store);
  return copyConfigModule(updated);
}

function seedTenantStore(slug: string): TenantStore {
  const now = new Date().toISOString();
  const appointments = seedAppointments();
  const clients = seedClients(now);
  const services = seedServices(now);
  const products = seedProducts(now);

  return {
    slug,
    appointments,
    appointmentHolds: [],
    clients,
    services,
    products,
    sales: seedSales(now, clients, services, products),
    costs: seedCosts(now),
    quotes: seedQuotes(now, clients, services),
    walletMovements: seedWalletMovements(now, clients),
    giftCards: seedGiftCards(now, clients),
    notifications: seedNotifications(now),
    automationRules: seedAutomationRules(now),
    packages: seedPackageCatalog(now, services),
    clientPackages: seedClientPackages(now, clients),
    prepaids: seedPrepaids(now, clients, services),
    preorders: seedPreorders(now, clients, products),
    coupons: seedCoupons(now),
    promotions: seedPromotions(now),
    giftBoxes: seedGiftBoxes(now, clients, services),
    gifts: seedGifts(now, clients),
    installmentPlans: seedInstallmentPlans(now, clients),
    commissions: seedCommissions(now),
    configModules: seedConfigModules(now),
    updatedAt: now,
  };
}

function ensureTenantStoreShape(store: TenantStore): TenantStore {
  const now = new Date().toISOString();
  store.appointments ??= seedAppointments();
  store.appointmentHolds ??= [];
  store.clients ??= seedClients(now);
  store.services ??= seedServices(now);
  store.products ??= seedProducts(now);
  store.sales ??= seedSales(now, store.clients, store.services, store.products);
  store.costs ??= seedCosts(now);
  store.quotes ??= seedQuotes(now, store.clients, store.services);
  store.walletMovements ??= seedWalletMovements(now, store.clients);
  store.giftCards ??= seedGiftCards(now, store.clients);
  store.notifications ??= seedNotifications(now);
  store.automationRules ??= seedAutomationRules(now);
  store.packages ??= seedPackageCatalog(now, store.services);
  store.clientPackages ??= seedClientPackages(now, store.clients);
  store.prepaids ??= seedPrepaids(now, store.clients, store.services);
  store.preorders ??= seedPreorders(now, store.clients, store.products);
  store.coupons ??= seedCoupons(now);
  store.promotions ??= seedPromotions(now);
  store.giftBoxes ??= seedGiftBoxes(now, store.clients, store.services);
  store.gifts ??= seedGifts(now, store.clients);
  store.installmentPlans ??= seedInstallmentPlans(now, store.clients);
  store.commissions ??= seedCommissions(now);
  store.configModules ??= seedConfigModules(now);
  store.updatedAt ??= now;
  return store;
}

function seedAppointments(): AppointmentWithMeta[] {
  return appointmentSeed.map((appointment) => ({ ...appointment, date: todayIso(), locationId: 1 }));
}

function seedClients(now: string): ManagedClient[] {
  return clientSeed.map((client, index) => ({
    ...client,
    id: index + 1,
    email: client.name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "") + "@example.test",
    phone: `+39 02 0000 10${index}`,
    locationId: index % 2 === 0 ? 1 : 2,
    tags: index === 0 ? ["VIP"] : [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));
}

function seedServices(now: string): ManagedService[] {
  return serviceSeed.map((service, index) => ({
    ...service,
    id: index + 1,
    description: centerServices.find((item) => item.name === service.name)?.description ?? "",
    locationIds: [1, 2],
    active: true,
    bookingEnabled: true,
    createdAt: now,
    updatedAt: now,
  }));
}

function seedProducts(now: string): ManagedProduct[] {
  return productSeed.map((product, index) => {
    const stock = 8 + product.id * 4;
    return {
      ...product,
      sku: `ELITE-${String(product.id).padStart(3, "0")}`,
      stock,
      minStock: 4,
      locationId: index % 2 === 0 ? 1 : 2,
      publicVisible: product.id === 1,
      movements: [createStockMovement(product.id, "carico", stock, "Giacenza iniziale", index % 2 === 0 ? 1 : 2)],
      createdAt: now,
      updatedAt: now,
    };
  });
}

function seedSales(now: string, clients: ManagedClient[], services: ManagedService[], products: ManagedProduct[]): PosSale[] {
  const service = services[0];
  const product = products[0];
  if (!service || !product) return [];

  return [
    {
      id: 1,
      code: "S-00001",
      clientId: clients[0]?.id ?? 0,
      clientName: clients[0]?.name ?? "Cliente banco",
      locationId: 1,
      items: [
        {
          id: 1,
          type: "service",
          refId: service.id,
          name: service.name,
          quantity: 1,
          unitPrice: parseMoney(service.price),
          total: parseMoney(service.price),
          status: "executed",
        },
        {
          id: 2,
          type: "product",
          refId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: parseMoney(product.price),
          total: parseMoney(product.price),
          status: "collected",
        },
      ],
      payments: [{ id: 1, method: "card", amount: roundMoney(parseMoney(service.price) + parseMoney(product.price)) }],
      subtotal: roundMoney(parseMoney(service.price) + parseMoney(product.price)),
      discount: 0,
      total: roundMoney(parseMoney(service.price) + parseMoney(product.price)),
      paidAmount: roundMoney(parseMoney(service.price) + parseMoney(product.price)),
      changeDue: 0,
      status: "active",
      createdAt: now,
    },
  ];
}

function seedCosts(now: string): CostItem[] {
  return [
    {
      id: 1,
      title: "Affitto sede",
      category: "Sede",
      supplier: "Immobiliare Milano",
      amount: 1200,
      dueDate: addDaysIso(5),
      recurrence: "monthly",
      locationId: 1,
      status: "open",
      createdAt: now,
    },
    {
      id: 2,
      title: "Materiale consumo",
      category: "Forniture",
      supplier: "Reviva",
      amount: 280,
      dueDate: addDaysIso(-2),
      recurrence: "none",
      locationId: 1,
      status: "overdue",
      createdAt: now,
    },
  ];
}

function seedQuotes(now: string, clients: ManagedClient[], services: ManagedService[]): Quote[] {
  const service = services[0];
  const client = clients[0];
  if (!service || !client) return [];

  const unitPrice = parseMoney(service.price);
  return [
    {
      id: 1,
      code: "Q-00001",
      clientId: client.id,
      clientName: client.name,
      lines: [{ id: 1, type: "service", refId: service.id, name: service.name, quantity: 2, unitPrice, total: roundMoney(unitPrice * 2) }],
      subtotal: roundMoney(unitPrice * 2),
      discount: 10,
      total: roundMoney(unitPrice * 2 - 10),
      status: "sent",
      publicToken: randomCode("qt"),
      expiresAt: addDaysIso(20),
      createdAt: now,
    },
  ];
}

function seedWalletMovements(now: string, clients: ManagedClient[]): WalletMovement[] {
  const clientId = clients[0]?.id ?? 0;
  return [
    { id: 1, clientId, type: "recharge", amount: 100, points: 0, note: "Ricarica iniziale", source: "pos", createdAt: now },
    { id: 2, clientId, type: "points_earn", amount: 0, points: 42, note: "Punti da vendita", source: "fidelity", createdAt: now },
  ];
}

function seedGiftCards(now: string, clients: ManagedClient[]): GiftCard[] {
  return [
    {
      id: 1,
      code: "GC-DEMO-001",
      clientId: clients[0]?.id ?? 0,
      recipientName: "Giulia R.",
      initialAmount: 120,
      balance: 120,
      status: "active",
      expiresAt: addDaysIso(180),
      createdAt: now,
    },
  ];
}

function seedNotifications(now: string): NotificationItem[] {
  return [
    {
      id: 1,
      type: "appointment",
      title: "Richiesta appuntamento",
      message: "Nuova richiesta da booking pubblico",
      read: false,
      link: "appointments",
      createdAt: now,
    },
  ];
}

function seedAutomationRules(now: string): AutomationRule[] {
  return [
    { id: 1, name: "Reminder appuntamento 24h", channel: "sms", trigger: "appointment_reminder", enabled: true, createdAt: now },
    { id: 2, name: "Follow-up preventivo", channel: "email", trigger: "quote_followup", enabled: true, createdAt: now },
    { id: 3, name: "Avviso scadenza costo", channel: "browser", trigger: "cost_due", enabled: true, createdAt: now },
  ];
}

function seedPackageCatalog(now: string, services: ManagedService[]): PackageCatalog[] {
  const service = services[0];
  if (!service) return [];
  return [
    {
      id: 1,
      name: "Percorso viso 5 sedute",
      price: roundMoney(parseMoney(service.price) * 4.5),
      items: [{ serviceId: service.id, serviceName: service.name, sessions: 5 }],
      active: true,
      locationIds: [1, 2],
      createdAt: now,
    },
  ];
}

function seedClientPackages(now: string, clients: ManagedClient[]): ClientPackage[] {
  const client = clients[0];
  if (!client) return [];
  return [
    {
      id: 1,
      packageId: 1,
      clientId: client.id,
      clientName: client.name,
      name: "Percorso viso 5 sedute",
      totalSessions: 5,
      remainingSessions: 3,
      expiresAt: addDaysIso(120),
      status: "active",
      createdAt: now,
    },
  ];
}

function seedPrepaids(now: string, clients: ManagedClient[], services: ManagedService[]): ClientPrepaid[] {
  const client = clients[0];
  const service = services[0];
  if (!client || !service) return [];
  return [
    {
      id: 1,
      clientId: client.id,
      clientName: client.name,
      serviceId: service.id,
      serviceName: service.name,
      totalQuantity: 3,
      remainingQuantity: 2,
      expiresAt: addDaysIso(90),
      status: "active",
      createdAt: now,
    },
  ];
}

function seedPreorders(now: string, clients: ManagedClient[], products: ManagedProduct[]): Preorder[] {
  const client = clients[0];
  const product = products[0];
  if (!client || !product) return [];
  return [
    {
      id: 1,
      clientId: client.id,
      clientName: client.name,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      deposit: 20,
      dueDate: addDaysIso(7),
      status: "open",
      createdAt: now,
    },
  ];
}

function seedCoupons(now: string): CouponRule[] {
  return [
    {
      id: 1,
      code: "WELCOME10",
      type: "percent",
      value: 10,
      minSubtotal: 40,
      active: true,
      startsAt: addDaysIso(-30),
      endsAt: addDaysIso(60),
      usageLimit: 100,
      usedCount: 2,
      createdAt: now,
    },
  ];
}

function seedPromotions(now: string): PromotionRule[] {
  return [
    {
      id: 1,
      name: "Promo nuovo cliente",
      target: "new_clients",
      discountType: "fixed",
      discountValue: 15,
      active: true,
      startsAt: addDaysIso(-10),
      endsAt: addDaysIso(45),
      channel: "booking",
      createdAt: now,
    },
  ];
}

function seedGiftBoxes(now: string, clients: ManagedClient[], services: ManagedService[]): GiftBoxInstance[] {
  const client = clients[0];
  const service = services[0];
  if (!client || !service) return [];
  return [
    {
      id: 1,
      code: "GB-DEMO-001",
      clientId: client.id,
      recipientName: "Giulia R.",
      items: [{ serviceId: service.id, serviceName: service.name, sessions: 2 }],
      remainingItems: 2,
      status: "active",
      expiresAt: addDaysIso(180),
      createdAt: now,
    },
  ];
}

function seedGifts(now: string, clients: ManagedClient[]): GiftReward[] {
  const client = clients[0];
  if (!client) return [];
  return [
    {
      id: 1,
      clientId: client.id,
      clientName: client.name,
      title: "Omaggi compleanno",
      rewardType: "discount",
      value: 20,
      status: "available",
      expiresAt: addDaysIso(30),
      createdAt: now,
    },
  ];
}

function seedInstallmentPlans(now: string, clients: ManagedClient[]): InstallmentPlan[] {
  const client = clients[0];
  if (!client) return [];
  return [
    {
      id: 1,
      saleId: 1,
      clientId: client.id,
      clientName: client.name,
      total: 300,
      paid: 100,
      status: "active",
      installments: [
        { id: 1, dueDate: addDaysIso(-5), amount: 100, status: "paid", paidAt: now },
        { id: 2, dueDate: addDaysIso(10), amount: 100, status: "due" },
        { id: 3, dueDate: addDaysIso(40), amount: 100, status: "due" },
      ],
      createdAt: now,
    },
  ];
}

function seedCommissions(now: string): CommissionEntry[] {
  return [
    {
      id: 1,
      staffName: "Sofia",
      saleId: 1,
      baseAmount: 80,
      rate: 10,
      amount: 8,
      status: "open",
      createdAt: now,
    },
  ];
}

function seedConfigModules(now: string): ConfigModuleState[] {
  return [
    configModule("quote_settings", "Impostazioni preventivi", "quote_settings.php", now, [
      ["Condizioni standard", "Testo mostrato nei preventivi PDF", "Attivo"],
      ["Firma digitale", "Firma e logo in documento", "Configurata"],
    ]),
    configModule("pos_settings", "Impostazioni POS", "pos_settings.php", now, [
      ["Numerazione ricevute", "Progressivo vendite e prefisso", "S-00001"],
      ["Pagamento misto", "Carta, contanti, wallet e giftcard", "Attivo"],
    ]),
    configModule("cost_categories", "Categorie costi", "costs.php?tab=categories", now, [
      ["Affitto", "Categoria ricorrente", "Attiva"],
      ["Forniture", "Categoria magazzino e costi", "Attiva"],
    ]),
    configModule("product_categories", "Categorie prodotti", "products.php?action=categories", now, [
      ["Skincare", "Categoria catalogo retail", "12 prodotti"],
      ["Solari", "Categoria stagionale", "Pubblica"],
    ]),
    configModule("stock_moves", "Carico / Scarico", "stock_moves.php", now, [
      ["Carico iniziale", "Documento stock demo", "Completato"],
      ["Rettifica giacenza", "Movimento manuale protetto", "Disponibile"],
    ]),
    configModule("suppliers", "Fornitori", "suppliers.php", now, [
      ["Reviva", "Forniture cabina e consumo", "Attivo"],
      ["Beauty Lab", "Prodotti retail", "Attivo"],
    ]),
    configModule("client_sheets", "Schede cliente", "client_sheets.php", now, [
      ["Anamnesi viso", "Template scheda tecnica", "4 campi"],
      ["Trattamento corpo", "Template con note operatore", "6 campi"],
    ]),
    configModule("client_sheet_templates", "Template schede", "client_sheet_templates.php", now, [
      ["Preset anamnesi", "Modello riutilizzabile", "Sistema"],
      ["Preset trattamento", "Campi dinamici cliente", "Attivo"],
    ]),
    configModule("client_consents", "Consensi cliente", "client_consents.php", now, [
      ["Privacy GDPR", "Modulo firma pubblico", "Firmabile"],
      ["Consenso trattamento", "Documento informato", "In uso"],
    ]),
    configModule("package_settings", "Impostazioni pacchetti", "packages.php?tab=settings", now, [
      ["Validita default", "Scadenza automatica residui", "Configurata"],
      ["Catalogo pacchetti", "Pacchetti e servizi inclusi", "Attivo"],
    ]),
    configModule("resources", "Risorse", "resources.php", now, [
      ["Laser viso", "Risorsa condivisa per sede", "1 disponibile"],
      ["Pressoterapia", "Risorsa con quantita", "2 disponibili"],
    ]),
    configModule("service_categories", "Categorie servizi", "services.php?tab=categories", now, [
      ["Viso", "Categoria booking", "Pubblica"],
      ["Corpo", "Categoria booking", "Pubblica"],
    ]),
    configModule("service_recommendations", "Servizi consigliati", "services.php?tab=recommended", now, [
      ["Pulizia + booster", "Cross-sell booking", "Attivo"],
      ["Massaggio + pressoterapia", "Percorso consigliato", "Attivo"],
    ]),
    configModule("cabins", "Cabine", "cabins.php", now, [
      ["Cabina 1", "Sede Milano Centro", "Attiva"],
      ["Cabina 2", "Sede Milano Centro", "Attiva"],
    ]),
    configModule("staff", "Operatori", "staff.php", now, [
      ["Sofia", "Estetista senior", "Admin operativo"],
      ["Marta", "Operatrice trattamenti", "Staff"],
    ]),
    configModule("staff_availability", "Disponibilita", "staff_availability.php", now, [
      ["Sofia lun-ven", "Turno 09:00-18:00", "Attivo"],
      ["Marta part-time", "Turno 10:00-16:00", "Attivo"],
    ]),
    configModule("hours", "Orari", "hours.php", now, [
      ["Milano Centro", "Lun-sab 09:00-19:00", "Aperto"],
      ["Chiusure", "Festivi e ferie", "Configurato"],
    ]),
    configModule("business_profile", "Profilo attivita", "business_profile.php", now, [
      ["Branding", "Logo, colore e descrizione", "Completo"],
      ["Contatti", "Email, telefono, WhatsApp", "Completo"],
    ]),
    configModule("locations", "Sedi", "locations.php", now, [
      ["Milano Centro", "Via Roma 12", "Booking abilitato"],
      ["Milano Isola", "Via Borsieri 8", "Marketplace"],
    ]),
    configModule("consent_modules", "Moduli consenso", "consent_modules.php", now, [
      ["Modulo privacy", "GDPR pubblico", "Attivo"],
      ["Modulo trattamento", "Consenso informato", "Attivo"],
    ]),
    configModule("accessibility", "Accessibilita", "accessibility.php", now, [
      ["Email account", "info@artebrand.it", "Verificata"],
      ["Password", "Cambio protetto", "Disponibile"],
    ]),
    configModule("roles", "Ruoli", "roles.php", now, [
      ["Staff", "Permessi operativi", "Configurato"],
      ["Altro", "Accesso limitato", "Configurato"],
    ]),
    configModule("marketplace", "Marketplace", "marketplace.php", now, [
      ["Scheda pubblica", "Profilo Centro Estetico Elite", "Pubblicata"],
      ["Servizi evidenza", "Mostrati in marketplace", "Attivi"],
    ]),
    configModule("fidelity_membership", "Adesione", "fidelity_membership.php", now, [
      ["Programma fidelity", "Iscrizione e tessere", "Attivo"],
      ["Regole adesione", "Consensi e condizioni", "Configurate"],
    ]),
    configModule("fidelity_levels", "Livelli Card", "fidelity_points.php#livelli-card", now, [
      ["Soglia Silver", "Livello card punti", "200 punti"],
      ["Soglia Gold", "Livello card punti", "500 punti"],
    ]),
    configModule("giftbox_settings", "Impostazioni GiftBox", "giftbox_settings.php", now, [
      ["Validita default", "Scadenza GiftBox", "Configurata"],
      ["Termini GiftBox", "Testo voucher", "Attivo"],
    ]),
    configModule("giftcard_settings", "Impostazioni GiftCard", "giftcard_settings.php", now, [
      ["Validita default", "Scadenza GiftCard", "Configurata"],
      ["Termini GiftCard", "Testo voucher", "Attivo"],
    ]),
  ];
}

function configModule(id: string, title: string, source: string, now: string, rows: Array<[string, string, string]>): ConfigModuleState {
  return {
    id,
    title,
    source,
    records: rows.map(([rowTitle, detail, value], index) => ({
      id: index + 1,
      module: id,
      title: rowTitle,
      detail,
      value,
      active: true,
      updatedAt: now,
    })),
    settings: {
      cloned: true,
      source,
    },
    updatedAt: now,
  };
}

function normalizeTenantStoreSlug(slug: string): string {
  return slug.trim().toLowerCase() || defaultTenantSlug;
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function addDaysIso(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextRecurringDate(date: string, recurrence: CostRecurrence): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  if (recurrence === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function nextId(items: Array<{ id: number }>): number {
  return items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

function normalizeName(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function sanitizeLocationId(value: unknown): number {
  const locationId = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(locationId) && locationId > 0 ? locationId : 1;
}

function normalizeLocationIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    const ids = value.map(sanitizeLocationId);
    return Array.from(new Set(ids.length > 0 ? ids : [1]));
  }

  const ids = String(value ?? "1")
    .split(",")
    .map((item) => sanitizeLocationId(item))
    .filter((id) => id > 0);

  return Array.from(new Set(ids.length > 0 ? ids : [1]));
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function samePersonToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveSaleClient(store: TenantStore, clientId?: number, clientName?: string): { id: number; name: string } {
  const id = clientId && clientId > 0 ? clientId : 0;
  const client = id > 0 ? store.clients.find((item) => item.id === id && !item.archived) : null;
  if (client) return { id: client.id, name: client.name };

  const fallbackName = clientName?.trim() || "Cliente banco";
  return { id: 0, name: fallbackName };
}

function refreshCostStatuses(slug = defaultTenantSlug): void {
  const store = getTenantStore(slug);
  store.costs = store.costs.map((cost) => (cost.status === "paid" ? cost : { ...cost, status: statusForCost(cost) }));
}

function statusForCost(cost: CostItem): CostStatus {
  if (cost.status === "paid") return "paid";
  return cost.dueDate < todayIso() ? "overdue" : "open";
}

function updateQuoteStatus(id: number, status: QuoteStatus, slug = defaultTenantSlug): Quote {
  const store = getTenantStore(slug);
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) throw new Error("Preventivo non trovato.");
  const updated = { ...quote, status };
  store.quotes = store.quotes.map((item) => (item.id === id ? updated : item));
  touchStore(store);
  return copyQuote(updated);
}

function refreshGiftCardStatuses(slug = defaultTenantSlug): void {
  const store = getTenantStore(slug);
  store.giftCards = store.giftCards.map((giftCard) => {
    if (giftCard.status !== "active") return giftCard;
    if (giftCard.expiresAt < todayIso()) return { ...giftCard, status: "expired" };
    return giftCard;
  });
}

function generateDerivedNotifications(slug = defaultTenantSlug): void {
  const store = getTenantStore(slug);
  const existingKeys = new Set(store.notifications.map((notification) => `${notification.type}:${notification.link}:${notification.title}`));

  for (const cost of store.costs) {
    if (cost.status !== "overdue") continue;
    const title = `${cost.title} scaduto`;
    const key = `cost:costs:${title}`;
    if (!existingKeys.has(key)) notify(store, "cost", title, `${cost.amount} euro`, "costs");
  }

  for (const quote of store.quotes) {
    if (quote.status !== "accepted") continue;
    const title = `${quote.code} accettato`;
    const key = `quote:quotes:${title}`;
    if (!existingKeys.has(key)) notify(store, "quote", title, quote.clientName, "quotes");
  }
}

function notify(store: TenantStore, type: NotificationItem["type"], title: string, message: string, link: string): NotificationItem {
  const notification: NotificationItem = {
    id: nextId(store.notifications),
    type,
    title,
    message,
    read: false,
    link,
    createdAt: new Date().toISOString(),
  };
  store.notifications = [notification, ...store.notifications];
  return { ...notification };
}

function refreshResidualStatuses(store: TenantStore): void {
  const today = todayIso();
  store.clientPackages = store.clientPackages.map((clientPackage) => {
    if (clientPackage.status !== "active") return clientPackage;
    if (clientPackage.expiresAt && clientPackage.expiresAt < today) return { ...clientPackage, status: "expired" };
    return clientPackage;
  });
  store.prepaids = store.prepaids.map((prepaid) => {
    if (prepaid.status !== "active") return prepaid;
    if (prepaid.expiresAt && prepaid.expiresAt < today) return { ...prepaid, status: "expired" };
    return prepaid;
  });
  store.giftBoxes = store.giftBoxes.map((giftBox) => {
    if (giftBox.status !== "active") return giftBox;
    if (giftBox.expiresAt < today) return { ...giftBox, status: "expired" };
    return giftBox;
  });
  store.gifts = store.gifts.map((gift) => {
    if (gift.status !== "available") return gift;
    if (gift.expiresAt < today) return { ...gift, status: "expired" };
    return gift;
  });
}

function refreshInstallmentStatuses(store: TenantStore): void {
  const today = todayIso();
  store.installmentPlans = store.installmentPlans.map((plan) => {
    if (plan.status === "cancelled") return plan;
    const installments = plan.installments.map((installment) => {
      if (installment.status === "paid") return installment;
      return { ...installment, status: installment.dueDate < today ? "overdue" as InstallmentStatus : "due" as InstallmentStatus };
    });
    const paid = roundMoney(installments.filter((installment) => installment.status === "paid").reduce((total, installment) => total + installment.amount, 0));
    return {
      ...plan,
      paid,
      installments,
      status: paid + 0.00001 >= plan.total ? "completed" as InstallmentPlanStatus : "active" as InstallmentPlanStatus,
    };
  });
}

function copyPackageCatalog(catalog: PackageCatalog): PackageCatalog {
  return {
    ...catalog,
    items: catalog.items.map((item) => ({ ...item })),
    locationIds: [...catalog.locationIds],
  };
}

function copyInstallmentPlan(plan: InstallmentPlan): InstallmentPlan {
  return {
    ...plan,
    installments: plan.installments.map((installment) => ({ ...installment })),
  };
}

function copyConfigModule(moduleState: ConfigModuleState): ConfigModuleState {
  return {
    ...moduleState,
    records: moduleState.records.map((record) => ({ ...record })),
    settings: { ...moduleState.settings },
  };
}

function normalizeConfigModuleId(moduleId: string): string {
  return moduleId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || "custom";
}

function createFallbackConfigModule(moduleId: string): ConfigModuleState {
  const now = new Date().toISOString();
  return configModule(moduleId, moduleId.replace(/_/g, " "), `${moduleId}.php`, now, [
    ["Record demo", "Modulo non mappato nel seed iniziale", "Attivo"],
  ]);
}

function upsertConfigModule(modules: ConfigModuleState[], moduleState: ConfigModuleState): ConfigModuleState[] {
  if (modules.some((item) => item.id === moduleState.id)) {
    return modules.map((item) => (item.id === moduleState.id ? moduleState : item));
  }
  return [...modules, moduleState];
}

function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function activeWindow(startsAt: string, endsAt: string): boolean {
  const today = todayIso();
  return startsAt <= today && endsAt >= today;
}

function discountValue(type: CouponType, value: number, subtotal: number): number {
  if (type === "percent") return roundMoney(Math.min(subtotal, subtotal * Math.max(0, value) / 100));
  return roundMoney(Math.min(subtotal, Math.max(0, value)));
}

function buildSaleItem(store: TenantStore, input: PosSaleItemInput, id: number): PosSaleItem {
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const refId = input.refId && input.refId > 0 ? input.refId : 0;
  const type = input.type;

  if (type === "service") {
    const service = refId > 0 ? store.services.find((item) => item.id === refId) : null;
    const unitPrice = roundMoney(input.unitPrice ?? parseMoney(service?.price ?? "0"));
    return {
      id,
      type,
      refId: service?.id ?? refId,
      name: input.name?.trim() || service?.name || "Servizio",
      quantity,
      unitPrice,
      total: roundMoney(unitPrice * quantity),
      status: input.status ?? "executed",
    };
  }

  if (type === "product") {
    const product = refId > 0 ? store.products.find((item) => item.id === refId) : null;
    if (!product && !input.name) throw new Error("Prodotto non trovato.");
    const unitPrice = roundMoney(input.unitPrice ?? parseMoney(product?.price ?? "0"));
    return {
      id,
      type,
      refId: product?.id ?? refId,
      name: input.name?.trim() || product?.name || "Prodotto",
      quantity,
      unitPrice,
      total: roundMoney(unitPrice * quantity),
      status: input.status ?? "collected",
    };
  }

  const unitPrice = roundMoney(input.unitPrice ?? 0);
  return {
    id,
    type,
    refId,
    name: input.name?.trim() || specialSaleItemName(type),
    quantity,
    unitPrice,
    total: roundMoney(unitPrice * quantity),
    status: input.status ?? "prepaid",
  };
}

function specialSaleItemName(type: PosSaleItemType): string {
  if (type === "giftcard") return "GiftCard";
  if (type === "package") return "Pacchetto";
  if (type === "giftbox") return "GiftBox";
  return "Prepagato";
}

function normalizePayments(payments: PosPaymentInput[], total: number): PosPayment[] {
  const normalized = payments
    .map((payment, index) => ({
      id: index + 1,
      method: normalizePaymentMethod(payment.method),
      amount: roundMoney(Math.max(0, payment.amount)),
    }))
    .filter((payment) => payment.amount > 0);

  if (normalized.length > 0) return normalized;
  return [{ id: 1, method: "card", amount: total }];
}

function normalizePaymentMethod(method: PosPaymentMethod | string): PosPaymentMethod {
  if (method === "cash" || method === "card" || method === "transfer" || method === "giftcard" || method === "wallet") {
    return method;
  }
  return "card";
}

function validateProductStock(store: TenantStore, items: PosSaleItem[]): void {
  for (const item of items) {
    if (item.type !== "product" || item.refId <= 0) continue;
    const product = store.products.find((candidate) => candidate.id === item.refId);
    if (!product) throw new Error(`Prodotto ${item.name} non trovato.`);
    if (product.stock < item.quantity) throw new Error(`Giacenza insufficiente per ${product.name}.`);
  }
}

function applyProductStockForSale(store: TenantStore, sale: PosSale): void {
  for (const item of sale.items) {
    if (item.type !== "product" || item.refId <= 0) continue;
    const product = store.products.find((candidate) => candidate.id === item.refId);
    if (!product) continue;
    const movement = createStockMovement(product.id, "scarico", item.quantity, `Vendita ${sale.code}`, sale.locationId);
    item.stockMovementId = movement.id;
    const updated = {
      ...product,
      stock: product.stock - item.quantity,
      movements: [movement, ...product.movements],
      updatedAt: new Date().toISOString(),
    };
    store.products = store.products.map((candidate) => (candidate.id === product.id ? updated : candidate));
  }
}

function restoreProductStockForSale(store: TenantStore, sale: PosSale): void {
  for (const item of sale.items) {
    if (item.type !== "product" || item.refId <= 0) continue;
    const product = store.products.find((candidate) => candidate.id === item.refId);
    if (!product) continue;
    const movement = createStockMovement(product.id, "carico", item.quantity, `Ripristino ${sale.code}`, sale.locationId);
    const updated = {
      ...product,
      stock: product.stock + item.quantity,
      movements: [movement, ...product.movements],
      updatedAt: new Date().toISOString(),
    };
    store.products = store.products.map((candidate) => (candidate.id === product.id ? updated : candidate));
  }
}

function applySpecialSaleItems(slug: string, sale: PosSale): void {
  for (const item of sale.items) {
    if (sale.clientId <= 0) continue;
    if (item.type === "prepaid") {
      issuePrepaid({
        clientId: sale.clientId,
        clientName: sale.clientName,
        serviceId: item.refId,
        quantity: item.quantity,
        sourceSaleId: sale.id,
      }, slug);
    }
    if (item.type === "giftcard") {
      issueGiftCard({
        clientId: sale.clientId,
        recipientName: sale.clientName,
        initialAmount: item.total,
        sourceSaleId: sale.id,
      }, slug);
    }
    if (item.type === "package") {
      issueClientPackage({
        packageId: item.refId,
        clientId: sale.clientId,
        clientName: sale.clientName,
        sourceSaleId: sale.id,
      }, slug);
    }
    if (item.type === "giftbox") {
      issueGiftBox({
        clientId: sale.clientId,
        recipientName: sale.clientName,
        serviceId: item.refId,
        sessions: item.quantity,
        sourceSaleId: sale.id,
      }, slug);
    }
  }
}

function rollbackSpecialSaleItems(store: TenantStore, sale: PosSale): void {
  store.clientPackages = store.clientPackages.map((item) =>
    item.sourceSaleId === sale.id && item.status === "active" ? { ...item, status: "cancelled" } : item,
  );
  store.prepaids = store.prepaids.map((item) =>
    item.sourceSaleId === sale.id && item.status === "active" ? { ...item, status: "cancelled" } : item,
  );
  store.giftCards = store.giftCards.map((item) =>
    item.sourceSaleId === sale.id && item.status === "active" ? { ...item, status: "cancelled" } : item,
  );
  store.giftBoxes = store.giftBoxes.map((item) =>
    item.sourceSaleId === sale.id && item.status === "active" ? { ...item, status: "cancelled" } : item,
  );
  store.installmentPlans = store.installmentPlans.map((plan) =>
    plan.saleId === sale.id && plan.status === "active" ? { ...plan, status: "cancelled" } : plan,
  );
}

function recordCommissionsForSale(store: TenantStore, sale: PosSale): void {
  const serviceItems = sale.items.filter((item) => item.type === "service" && item.total > 0);
  if (!serviceItems.length) return;
  const firstId = nextId(store.commissions);
  const entries = serviceItems.map((item, index) => {
    const rate = 10;
    return {
      id: firstId + index,
      staffName: "Sofia",
      saleId: sale.id,
      appointmentId: sale.appointmentId,
      baseAmount: item.total,
      rate,
      amount: roundMoney(item.total * rate / 100),
      status: "open" as CommissionStatus,
      createdAt: new Date().toISOString(),
    };
  });
  store.commissions = [...entries, ...store.commissions];
}

function reverseCommissionsForSale(store: TenantStore, sale: PosSale): void {
  store.commissions = store.commissions.map((commission) =>
    commission.saleId === sale.id && commission.status === "open" ? { ...commission, status: "reversed" } : commission,
  );
}

function applyClientSaleValue(store: TenantStore, clientId: number, delta: number): void {
  if (clientId <= 0 || Math.abs(delta) <= 0.00001) return;
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) return;
  const current = parseMoney(client.value);
  const next = Math.max(0, roundMoney(current + delta));
  const updated = {
    ...client,
    value: `${next} euro`,
    updatedAt: new Date().toISOString(),
  };
  store.clients = store.clients.map((item) => (item.id === clientId ? updated : item));
}

function completeSaleAppointment(store: TenantStore, appointmentId: number): void {
  store.appointments = store.appointments.map((appointment) =>
    appointment.id === appointmentId ? { ...appointment, status: "Completato" } : appointment,
  );
}

function reopenSaleAppointment(store: TenantStore, appointmentId: number): void {
  store.appointments = store.appointments.map((appointment) =>
    appointment.id === appointmentId ? { ...appointment, status: "Confermato" } : appointment,
  );
}

function normalizeStockCancelMode(mode: "restore" | "no_restore" | "none", sale: PosSale): "restore" | "no_restore" | "none" {
  const hasProductItems = sale.items.some((item) => item.type === "product" && item.refId > 0);
  if (!hasProductItems) return "none";
  if (mode === "no_restore") return "no_restore";
  return "restore";
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  const match = String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? roundMoney(Number.parseFloat(match[0])) : 0;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function copyService(service: ManagedService): ManagedService {
  return { ...service, locationIds: [...service.locationIds] };
}

function copyProduct(product: ManagedProduct): ManagedProduct {
  return { ...product, movements: product.movements.map((movement) => ({ ...movement })) };
}

function copySale(sale: PosSale): PosSale {
  return {
    ...sale,
    items: sale.items.map((item) => ({ ...item })),
    payments: sale.payments.map((payment) => ({ ...payment })),
  };
}

function copyQuote(quote: Quote): Quote {
  return {
    ...quote,
    lines: quote.lines.map((line) => ({ ...line })),
  };
}

function randomCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
}

function createStockMovement(
  productId: number,
  type: StockMovement["type"],
  quantity: number,
  reason: string,
  locationId: number,
): StockMovement {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    productId,
    type,
    quantity,
    reason: reason.trim() || "Movimento stock",
    locationId,
    createdAt: new Date().toISOString(),
  };
}
