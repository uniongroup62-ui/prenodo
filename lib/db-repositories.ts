import "server-only";

import { randomBytes } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { AppointmentStatus, Location } from "@/lib/demo-data";
import type { AppointmentWithMeta } from "@/lib/appointment-engine";
import type {
  AutomationRule,
  ClientPackage,
  ClientPackageStatus,
  ClientPrepaid,
  ClientPrepaidStatus,
  CommissionEntry,
  CommissionStatus,
  ConfigModuleState,
  ConfigRecord,
  CouponRule,
  CouponType,
  GiftBoxInstance,
  GiftBoxStatus,
  GiftCard,
  GiftCardStatus,
  GiftReward,
  Installment,
  InstallmentPlan,
  InstallmentPlanStatus,
  InstallmentStatus,
  ManagedClient,
  ManagedProduct,
  ManagedService,
  NotificationItem,
  PackageCatalog,
  PackageCatalogItem,
  CostItem,
  PosPaymentMethod,
  PosCheckoutInput,
  PosSaleItemInput,
  Preorder,
  PosSale,
  PosSaleItem,
  PosSummary,
  PromotionRule,
  Quote,
  QuoteLine,
  QuoteStatus,
  StockMovement,
  WalletMovement,
  WalletMovementType,
} from "@/lib/tenant-store";
import { tenantDelete, tenantInsert, tenantSelect, tenantTable, tenantUpdate, columnExists, dbExecute, dbQuery, quoteIdentifier, tableExists, tenantIdForSlug, type TenantTable } from "@/lib/tenant-db";
import { buildModernEmailTemplate, emailConfigured, sendEmail } from "@/lib/email";
import { assertAppointmentSlotAvailable } from "@/lib/public-booking-db";

export async function listDbLocations(slug: string): Promise<Location[]> {
  const table = await tenantTable(slug, "locations");
  const where = await columnExists(table.name, "is_active") ? "COALESCE(is_active, 1) = 1" : "";
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "locations",
    where,
    orderBy: "sort_order ASC, name ASC, id ASC",
  });

  return rows.map((row) => mapLocation(slug, row));
}

export async function listDbClients({
  slug,
  query = "",
  locationId = 0,
  includeArchived = false,
}: {
  slug: string;
  query?: string;
  locationId?: number;
  includeArchived?: boolean;
}): Promise<ManagedClient[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery) {
    clauses.push("(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)");
    params.push(`%${normalizedQuery}%`, `%${normalizedQuery}%`, `%${normalizedQuery}%`);
  }
  if (locationId > 0) {
    clauses.push("(location_id IS NULL OR location_id = ?)");
    params.push(locationId);
  }
  if (!includeArchived) clauses.push("COALESCE(is_blocked, 0) = 0");

  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "clients",
    where: clauses.join(" AND "),
    params,
    orderBy: "full_name ASC, id DESC",
  });

  return rows.map(mapClient);
}

export async function createDbClient(input: Partial<ManagedClient>, slug: string): Promise<ManagedClient> {
  const table = await tenantTable(slug, "clients");
  const name = normalizeName(input.name, "Nuovo cliente");
  const id = await tenantInsert(table, {
    full_name: name,
    first_name: firstName(name),
    last_name: lastName(name),
    email: input.email ?? null,
    phone: input.phone ?? null,
    location_id: input.locationId && input.locationId > 0 ? input.locationId : null,
    notes: input.note ?? null,
    registration_date: todayIso(),
    points: 0,
    credit_balance: 0,
    is_blocked: 0,
  });

  return getSingleClient(slug, id);
}

export async function updateDbClient(id: number, input: Partial<ManagedClient>, slug: string): Promise<ManagedClient> {
  const values: Record<string, unknown> = {
    full_name: input.name,
    email: input.email,
    phone: input.phone,
    location_id: input.locationId && input.locationId > 0 ? input.locationId : undefined,
    notes: input.note,
  };
  if (input.name) {
    values.first_name = firstName(input.name);
    values.last_name = lastName(input.name);
  }
  await tenantUpdate({ slug, table: "clients", id, values });
  return getSingleClient(slug, id);
}

export async function archiveDbClient(id: number, slug: string): Promise<ManagedClient> {
  await tenantUpdate({ slug, table: "clients", id, values: { is_blocked: 1, blocked_at: new Date(), blocked_internal_note: "Archiviato da replica Next" } });
  return getSingleClient(slug, id);
}

export async function deleteDbClient(id: number, slug: string): Promise<{ deleted: boolean; client: ManagedClient; reason: string }> {
  const client = await getSingleClient(slug, id);
  const affected = await tenantDelete({ slug, table: "clients", id });
  return { deleted: affected > 0, client, reason: affected > 0 ? "Cliente eliminato." : "Cliente non eliminato." };
}

export async function listDbServices({
  slug,
  query = "",
  locationId = 0,
  includeInactive = false,
}: {
  slug: string;
  query?: string;
  locationId?: number;
  includeInactive?: boolean;
}): Promise<ManagedService[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    clauses.push("LOWER(name) LIKE ?");
    params.push(`%${normalizedQuery}%`);
  }
  if (!includeInactive) clauses.push("COALESCE(is_active, 1) = 1");

  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "services",
    where: clauses.join(" AND "),
    params,
    orderBy: "sort_order ASC, name ASC",
  });

  const mapped = rows.map(mapService);
  if (locationId <= 0) return mapped;
  return mapped.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(locationId));
}

export async function createDbService(input: Partial<ManagedService>, slug: string): Promise<ManagedService> {
  const table = await tenantTable(slug, "services");
  const id = await tenantInsert(table, {
    name: normalizeName(input.name, "Nuovo servizio"),
    duration_min: parseDuration(input.duration, 30),
    price: parseMoney(input.price, 0),
    sort_order: 0,
    is_active: input.active === false ? 0 : 1,
    booking_enabled: input.bookingEnabled === false ? 0 : 1,
    no_operator: 0,
  });

  return getSingleService(slug, id);
}

export async function updateDbService(id: number, input: Partial<ManagedService>, slug: string): Promise<ManagedService> {
  await tenantUpdate({
    slug,
    table: "services",
    id,
    values: {
      name: input.name,
      duration_min: input.duration ? parseDuration(input.duration, 30) : undefined,
      price: input.price ? parseMoney(input.price, 0) : undefined,
      is_active: input.active === undefined ? undefined : input.active ? 1 : 0,
      booking_enabled: input.bookingEnabled === undefined ? undefined : input.bookingEnabled ? 1 : 0,
    },
  });
  return getSingleService(slug, id);
}

export async function deleteDbService(id: number, slug: string): Promise<{ deleted: boolean; deactivated: boolean; service: ManagedService; reason: string }> {
  await tenantUpdate({ slug, table: "services", id, values: { is_active: 0, booking_enabled: 0 } });
  return { deleted: false, deactivated: true, service: await getSingleService(slug, id), reason: "Servizio disattivato come nel gestionale quando ha storico collegato." };
}

export type QuickBookingCabin = {
  id: number;
  name: string;
  locationId: number | null;
};

// Active cabins for the quick-booking offcanvas cabin select (tenant-scoped).
// The cabins table is optional per tenant; a missing table yields an empty list
// rather than an error so the drawer still works without cabins configured.
export async function listQuickBookingCabins(slug: string): Promise<QuickBookingCabin[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "cabins",
    where: "COALESCE(is_active, 1) = 1",
    orderBy: "position ASC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  return rows
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.name ?? ""),
      locationId: row.location_id === null || row.location_id === undefined || row.location_id === ""
        ? null
        : Number(row.location_id) || null,
    }))
    .filter((cabin) => cabin.id > 0);
}

export async function listDbProducts({
  slug,
  query = "",
  locationId = 0,
}: {
  slug: string;
  query?: string;
  locationId?: number;
}): Promise<ManagedProduct[]> {
  const clauses: string[] = ["COALESCE(is_active, 1) = 1"];
  const params: unknown[] = [];
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    clauses.push("(LOWER(name) LIKE ? OR LOWER(COALESCE(sku,'')) LIKE ? OR LOWER(COALESCE(brand,'')) LIKE ?)");
    params.push(`%${normalizedQuery}%`, `%${normalizedQuery}%`, `%${normalizedQuery}%`);
  }

  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "products",
    where: clauses.join(" AND "),
    params,
    orderBy: "name ASC",
  });

  const products = rows.map(mapProduct);
  if (locationId <= 0) return products;
  return products.filter((product) => product.locationId === locationId || product.locationId === 0);
}

export async function createDbProduct(input: Partial<ManagedProduct>, slug: string): Promise<ManagedProduct> {
  const table = await tenantTable(slug, "products");
  const id = await tenantInsert(table, {
    name: normalizeName(input.name, "Nuovo prodotto"),
    brand: input.brand ?? null,
    sku: input.sku ?? null,
    price: parseMoney(input.price, 0),
    stock: Math.max(0, Math.round(input.stock ?? 0)),
    min_stock: Math.max(0, Math.round(input.minStock ?? 0)),
    purchase_price: 0,
    incoming_qty: 0,
    reorder_qty: 0,
    is_active: 1,
    sell_online: input.publicVisible ? 1 : 0,
  });
  return getSingleProduct(slug, id);
}

export async function updateDbProduct(id: number, input: Partial<ManagedProduct>, slug: string): Promise<ManagedProduct> {
  await tenantUpdate({
    slug,
    table: "products",
    id,
    values: {
      name: input.name,
      brand: input.brand,
      sku: input.sku,
      price: input.price ? parseMoney(input.price, 0) : undefined,
      stock: input.stock === undefined ? undefined : Math.max(0, Math.round(input.stock)),
      min_stock: input.minStock === undefined ? undefined : Math.max(0, Math.round(input.minStock)),
      sell_online: input.publicVisible === undefined ? undefined : input.publicVisible ? 1 : 0,
    },
  });
  return getSingleProduct(slug, id);
}

export async function moveDbProductStock({
  productId,
  type,
  quantity,
  reason,
  slug,
}: {
  productId: number;
  type: StockMovement["type"];
  quantity: number;
  reason: string;
  slug: string;
}): Promise<ManagedProduct> {
  const product = await getSingleProduct(slug, productId);
  const amount = Math.max(0, Math.round(quantity));
  if (amount <= 0) throw new Error("Quantita non valida.");
  const nextStock = type === "rettifica" ? amount : product.stock + (type === "scarico" ? -amount : amount);
  if (nextStock < 0) throw new Error("Giacenza insufficiente.");

  await tenantUpdate({ slug, table: "products", id: productId, values: { stock: nextStock } });
  await tryInsertStockMove({ slug, productId, type, quantity: amount, reason });
  return getSingleProduct(slug, productId);
}

export async function deleteDbProduct(id: number, slug: string): Promise<{ deleted: boolean; product: ManagedProduct; reason: string }> {
  const product = await getSingleProduct(slug, id);
  await tenantUpdate({ slug, table: "products", id, values: { is_active: 0 } });
  return { deleted: false, product: { ...product, publicVisible: false }, reason: "Prodotto disattivato per conservare storico e movimenti." };
}

export async function listDbAppointments({
  slug,
  date,
  start,
  end,
}: {
  slug: string;
  date?: string;
  start?: string;
  end?: string;
}): Promise<AppointmentWithMeta[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (date) {
    clauses.push("DATE(starts_at) = ?");
    params.push(date);
  } else {
    if (start) {
      clauses.push("starts_at >= ?");
      params.push(`${start} 00:00:00`);
    }
    if (end) {
      clauses.push("starts_at < ?");
      params.push(`${end} 00:00:00`);
    }
  }

  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointments",
    where: clauses.join(" AND "),
    params,
    orderBy: "starts_at ASC",
  });

  return Promise.all(rows.map((row) => mapAppointment(slug, row)));
}

// Optional MULTI-SERVICE inputs shared by create/update. When `serviceNames`
// is non-empty the appointment is laid out as SEQUENTIAL segments (port of the
// legacy api_appointments.php save action). `staffMap`/`cabinMap` are keyed by
// service id (serviceId -> staffId / serviceId -> cabinId), `cabinId` is the
// explicit drawer cabin (appointments.cabin_id primary). When `serviceNames` is
// empty everything falls back to the single `serviceName` path unchanged.
export type MultiServiceAppointmentInput = {
  serviceNames?: string[];
  cabinId?: number | null;
  staffMap?: Record<number, number>;
  cabinMap?: Record<number, number>;
  // Quick-booking PACKAGE redeem (assets/js/app.js #qb_package_redeem): per-service
  // requests to cover a service with a client's prepaid package. Re-validated +
  // consumed server-side as part of the save (see applyAppointmentPackageRedeems).
  // Optional/empty -> the non-redeem save path is unchanged.
  packageRedeems?: AppointmentPackageRedeem[];
  // Mutable collector the save pushes per-redeem skip warnings into (so the route
  // can surface them without changing AppointmentWithMeta). Optional.
  packageWarnings?: string[];
  // Quick-booking PREPAID-SERVICE redeem (assets/js/app.js #qb_prepaid_service_redeem):
  // per-service requests to cover a service with a client's prepaid-service balance
  // (a prepaid is tied to ONE service directly). Re-validated + consumed server-side
  // as part of the save (see applyAppointmentPrepaidRedeems). Optional/empty -> the
  // non-redeem save path is unchanged. A service already covered by a package redeem
  // is NOT also prepaid-redeemed (the prepaid apply dedupes against it).
  prepaidRedeems?: AppointmentPrepaidRedeem[];
  // Mutable collector the save pushes per-prepaid-redeem skip warnings into. Optional.
  prepaidWarnings?: string[];
  // Quick-booking GIFTCARD redeem (assets/js/app.js #qb_giftcard_redeem): an
  // APPOINTMENT-LEVEL request to apply a client's giftcard BALANCE (a monetary amount)
  // toward the whole appointment (NOT per-service). Re-validated + the giftcard
  // decremented server-side as part of the save (see applyAppointmentGiftcardRedeem).
  // Only ONE giftcard per appointment (first valid). Optional/empty -> unchanged.
  giftcardRedeems?: AppointmentGiftcardRedeem[];
  // Mutable collector the save pushes giftcard-redeem skip warnings into. Optional.
  giftcardWarnings?: string[];
  // Quick-booking GIFTBOX redeem (assets/js/app.js #qb_giftbox_redeem): per-service
  // requests to cover a service with ONE ITEM from a client's giftbox (a per-service
  // item is consumed, the service is zero-charged). Re-validated + the redemption
  // recorded server-side as part of the save (see applyAppointmentGiftboxRedeems).
  // Optional/empty -> the non-redeem save path is unchanged. A service already covered
  // by a package OR prepaid redeem is NOT also giftbox-redeemed (the apply dedupes).
  giftboxRedeems?: AppointmentGiftboxRedeem[];
  // Mutable collector the save pushes per-giftbox-redeem skip warnings into. Optional.
  giftboxWarnings?: string[];
  // Quick-booking GIFT (omaggio) redeem (assets/js/app.js #qb_gift_redeem): per-service
  // requests to cover a service with ONE REWARD from the client's gift (a service reward is
  // a free service; one reward unit is consumed, the service is zero-charged). Re-validated +
  // the redemption recorded server-side as part of the save (see applyAppointmentGiftRedeems).
  // Optional/empty -> the non-redeem save path is unchanged. A service already covered by a
  // package, prepaid OR giftbox redeem is NOT also gift-redeemed (the apply dedupes).
  giftRedeems?: AppointmentGiftRedeem[];
  // Mutable collector the save pushes per-gift-redeem skip warnings into. Optional.
  giftWarnings?: string[];
};

// Resolved multi-service plan: the ordered services, the per-position segment
// layout (sequential in time, each with its own service/staff/cabin), the
// primary service/cabin, total duration, and the distinct staff ids to write to
// appointment_staff. Mirrors calc_total_duration_and_primary + rebuild_segments_for_appointment.
type AppointmentServicePlan = {
  services: RowDataPacket[];
  segments: Array<{
    service: RowDataPacket;
    staffId: number | null;
    cabinId: number | null;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
  }>;
  primaryService: RowDataPacket;
  primaryCabinId: number | null;
  totalDuration: number;
  end: string;
  staffIds: number[];
};

// Resolve the ordered service list (multi when serviceNames is given, else the
// single serviceName). Then build the sequential segment layout: segment k runs
// from the cumulative cursor to cursor + that service's duration, carrying its
// own staff (staffMap[serviceId], else the single operator) and cabin
// (cabinMap[serviceId], else the explicit cabinId, else the service's cabin).
// The primary service is the FIRST one; the primary cabin is the explicit
// cabinId when provided, else the first service's cabin. Tenant-scoped via the
// resolve* helpers.
async function planAppointmentServices({
  slug,
  serviceName,
  serviceNames,
  operatorStaffId,
  cabinId,
  staffMap,
  cabinMap,
  start,
}: {
  slug: string;
  serviceName: string;
  serviceNames: string[];
  operatorStaffId: number | null;
  cabinId: number | null;
  staffMap: Record<number, number>;
  cabinMap: Record<number, number>;
  start: string;
}): Promise<AppointmentServicePlan> {
  // Resolve services in order. Backward compatible: when serviceNames is empty
  // fall back to the single serviceName (single-service path unchanged).
  const orderedNames = serviceNames.length > 0 ? serviceNames : [serviceName];
  const services: RowDataPacket[] = [];
  for (const name of orderedNames) {
    services.push(await resolveServiceForAppointment(slug, name));
  }

  const primaryService = services[0];
  const primaryCabinId = cabinId ?? (primaryService.cabin_id === null || primaryService.cabin_id === undefined ? null : Number(primaryService.cabin_id) || null);

  const segments: AppointmentServicePlan["segments"] = [];
  const staffIdSet = new Set<number>();
  let cursor = start;
  let totalDuration = 0;
  for (const service of services) {
    const serviceId = Number(service.id ?? 0);
    const duration = Number(service.duration_min ?? 30);
    // Per-service staff: the explicit staffMap entry wins, else the single
    // operator (single-service path). 0 means "unassigned" → null segment staff.
    const mappedStaff = Number(staffMap[serviceId] ?? 0) || 0;
    const segStaffId = mappedStaff > 0 ? mappedStaff : operatorStaffId;
    // Per-service cabin: cabinMap entry, else the explicit drawer cabin, else
    // the service's own cabin (mirrors the legacy candidate fallback chain).
    const mappedCabin = Number(cabinMap[serviceId] ?? 0) || 0;
    const serviceCabin = service.cabin_id === null || service.cabin_id === undefined ? null : Number(service.cabin_id) || null;
    const segCabinId = mappedCabin > 0 ? mappedCabin : (cabinId ?? serviceCabin);
    const segEnd = addMinutesSqlDate(cursor, duration);
    segments.push({ service, staffId: segStaffId, cabinId: segCabinId, startsAt: cursor, endsAt: segEnd, durationMinutes: duration });
    if (segStaffId && segStaffId > 0) staffIdSet.add(segStaffId);
    cursor = segEnd;
    totalDuration += duration;
  }

  return {
    services,
    segments,
    primaryService,
    primaryCabinId,
    totalDuration,
    end: cursor,
    staffIds: Array.from(staffIdSet),
  };
}

export async function createDbAppointment({
  slug,
  clientName,
  serviceName,
  operator,
  time,
  date,
  locationId,
  holdToken,
  staffNotes,
  customerNotes,
  serviceNames = [],
  cabinId = null,
  staffMap = {},
  cabinMap = {},
  packageRedeems = [],
  packageWarnings,
  prepaidRedeems = [],
  prepaidWarnings,
  giftcardRedeems = [],
  giftcardWarnings,
  giftboxRedeems = [],
  giftboxWarnings,
  giftRedeems = [],
  giftWarnings,
}: {
  slug: string;
  clientName: string;
  serviceName: string;
  operator: string;
  time: string;
  date: string;
  locationId: number | null;
  holdToken?: string | null;
  staffNotes?: string | null;
  customerNotes?: string | null;
} & MultiServiceAppointmentInput): Promise<AppointmentWithMeta> {
  const client = await resolveClientForAppointment(slug, clientName, locationId);
  const staff = operator ? await resolveStaffForAppointment(slug, operator) : null;
  const operatorStaffId = staff ? Number(staff.id ?? 0) : null;
  const normalizedTime = normalizeTime(time);
  const start = `${date} ${normalizedTime}:00`;
  const plan = await planAppointmentServices({
    slug,
    serviceName,
    serviceNames,
    operatorStaffId,
    cabinId,
    staffMap,
    cabinMap,
    start,
  });
  const end = plan.end;
  const token = (holdToken ?? "").trim();
  if (token) {
    await assertDbAppointmentHold({
      slug,
      token,
      ownerKey: "manage",
      startsAt: start,
      serviceId: Number(plan.primaryService.id ?? 0),
      staffId: operatorStaffId,
      locationId,
    });
  }
  // Double-booking guard: refuse to book an operator already busy at this time.
  // Exclude this booking's own active hold (its [Disponibilità] reservation), so
  // the slot it reserved doesn't count against itself. Best-effort: only a real
  // detected overlap throws (the route turns it into { ok:false, error }).
  await assertAppointmentSlotAvailable({
    slug,
    date,
    segments: plan.segments.map((seg) => ({ staffId: seg.staffId, startsAt: seg.startsAt, endsAt: seg.endsAt, locationId })),
    excludeHoldToken: token || null,
  });
  const appointments = await tenantTable(slug, "appointments");
  const id = await tenantInsert(appointments, {
    client_id: client.id,
    service_id: plan.primaryService.id,
    cabin_id: plan.primaryCabinId,
    starts_at: start,
    ends_at: end,
    status: "pending",
    discount_value: 0,
    location_id: locationId,
    staff_notes: staffNotes || null,
    customer_notes: customerNotes || null,
  });

  // One appointment_services snapshot row per selected service (ordered).
  for (const service of plan.services) await insertAppointmentService(slug, id, service);
  // Distinct staff across all services (single operator + per-service staff).
  for (const staffId of plan.staffIds) await insertAppointmentStaff(slug, id, staffId);
  if (locationId) await insertAppointmentLocation(slug, id, locationId);
  // Sequential segments: position 0..n, each from cursor to cursor+duration.
  for (const [position, seg] of plan.segments.entries()) {
    await insertAppointmentSegment(slug, id, seg.service, seg.staffId, seg.startsAt, seg.endsAt, seg.durationMinutes, position, seg.cabinId);
  }
  // PACKAGE redeem: re-validate + consume + link AFTER the appointment_services
  // rows exist (the link/zero-charge targets those rows). Skipped entries become
  // warnings; the booking itself is never failed (legacy best-effort parity).
  // Services already covered by a package redeem MUST NOT also be prepaid-redeemed
  // (a service is covered once). We collect the package-covered service_ids and pass
  // them to the prepaid apply so it skips them (dedupe across the two redeem types).
  const packageCoveredServiceIds = new Set<number>();
  if (packageRedeems.length > 0) {
    const { applied, warnings } = await applyAppointmentPackageRedeems({
      slug,
      appointmentId: id,
      clientId: client.id,
      serviceIds: plan.services.map((service) => Number(service.id ?? 0)),
      redeems: packageRedeems,
    });
    for (const entry of applied) packageCoveredServiceIds.add(Number(entry.serviceId ?? 0));
    if (packageWarnings) packageWarnings.push(...warnings);
  }
  // PREPAID-SERVICE redeem: re-validate + consume + link AFTER the
  // appointment_services rows exist, and AFTER the package redeems so a service the
  // package already covered is skipped (dedupe via packageCoveredServiceIds). Skipped
  // entries become warnings; the booking itself is never failed (legacy parity).
  // A service covered by a package OR prepaid must not also be giftbox-redeemed. We
  // collect the prepaid-covered service_ids alongside the package ones into a single
  // `redeemCoveredServiceIds` set passed to the giftbox apply (dedupe across all three).
  const redeemCoveredServiceIds = new Set<number>(packageCoveredServiceIds);
  if (prepaidRedeems.length > 0) {
    const { applied, warnings } = await applyAppointmentPrepaidRedeems({
      slug,
      appointmentId: id,
      clientId: client.id,
      serviceIds: plan.services.map((service) => Number(service.id ?? 0)),
      redeems: prepaidRedeems,
      coveredServiceIds: packageCoveredServiceIds,
    });
    for (const entry of applied) redeemCoveredServiceIds.add(Number(entry.serviceId ?? 0));
    if (prepaidWarnings) prepaidWarnings.push(...warnings);
  }
  // GIFTBOX redeem: re-validate + RECORD (giftbox_redemptions + _items, qty 1) + link
  // AFTER the appointment_services rows exist, and AFTER package + prepaid so a service
  // already covered is skipped (dedupe via redeemCoveredServiceIds). GiftBox is
  // per-service + ITEM-based (one item covers one service); a covered service is
  // zero-charged. Skipped entries become warnings; the booking is never failed.
  if (giftboxRedeems.length > 0) {
    const { applied, warnings } = await applyAppointmentGiftboxRedeems({
      slug,
      appointmentId: id,
      clientId: client.id,
      serviceIds: plan.services.map((service) => Number(service.id ?? 0)),
      redeems: giftboxRedeems,
      coveredServiceIds: redeemCoveredServiceIds,
    });
    for (const entry of applied) redeemCoveredServiceIds.add(Number(entry.serviceId ?? 0));
    if (giftboxWarnings) giftboxWarnings.push(...warnings);
  }
  // GIFT (omaggio) redeem: re-validate + RECORD (appointment_gift_items, redeemed_at set,
  // qty 1) + link AFTER the appointment_services rows exist, and AFTER package + prepaid +
  // giftbox so a service already covered is skipped (dedupe via redeemCoveredServiceIds). A
  // gift instance holds reward items; a service reward applied to a service zero-charges it.
  // Skipped entries become warnings; the booking is never failed (legacy best-effort parity).
  if (giftRedeems.length > 0) {
    const { warnings } = await applyAppointmentGiftRedeems({
      slug,
      appointmentId: id,
      clientId: client.id,
      serviceIds: plan.services.map((service) => Number(service.id ?? 0)),
      redeems: giftRedeems,
      coveredServiceIds: redeemCoveredServiceIds,
    });
    if (giftWarnings) giftWarnings.push(...warnings);
  }
  // GIFTCARD redeem: re-validate + decrement + link AFTER the appointment_services
  // rows (and any package/prepaid zeroing) exist, because the payable total is
  // computed server-side from those rows (so a service zero-charged by a package/
  // prepaid never counts toward the giftcard cap). Appointment-level + monetary:
  // ONE giftcard per appointment (first valid), capped at min(balance, payableTotal).
  // Invalid -> warning, never fails the booking (legacy best-effort parity).
  if (giftcardRedeems.length > 0) {
    const { warnings } = await applyAppointmentGiftcardRedeem({
      slug,
      appointmentId: id,
      clientId: client.id,
      redeems: giftcardRedeems,
    });
    if (giftcardWarnings) giftcardWarnings.push(...warnings);
  }
  if (token) await markDbAppointmentHoldConverted(slug, token, "manage", id);

  const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", where: "id = ?", params: [id], limit: 1 });
  return mapAppointment(slug, rows[0]);
}

// Update an EXISTING appointment (by id, tenant-scoped). Mirrors
// createDbAppointment's resolution logic — client, service, operator/staff,
// date/time (+ recomputed end), location and notes — but replaces the snapshot
// child rows (appointment_services / appointment_staff / appointment_locations /
// appointment_segments) rather than appending. Guards that the appointment
// belongs to the tenant before writing; throws "Appuntamento non trovato." when
// it does not. Hold handling is unchanged from create: when a hold token is
// supplied it is validated against the new slot and marked converted.
export async function updateDbAppointment({
  slug,
  id,
  clientName,
  serviceName,
  operator,
  time,
  date,
  locationId,
  holdToken,
  staffNotes,
  customerNotes,
  serviceNames = [],
  cabinId = null,
  staffMap = {},
  cabinMap = {},
}: {
  slug: string;
  id: number;
  clientName: string;
  serviceName: string;
  operator: string;
  time: string;
  date: string;
  locationId: number | null;
  holdToken?: string | null;
  staffNotes?: string | null;
  customerNotes?: string | null;
} & MultiServiceAppointmentInput): Promise<AppointmentWithMeta> {
  // Tenant-scoped existence guard: the SELECT only returns rows for this tenant,
  // so a row from another tenant (or a missing id) yields no match.
  const existingRows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", columns: "id", where: "id = ?", params: [id], limit: 1 });
  if (!existingRows[0]) throw new Error("Appuntamento non trovato.");

  const client = await resolveClientForAppointment(slug, clientName, locationId);
  const staff = operator ? await resolveStaffForAppointment(slug, operator) : null;
  const operatorStaffId = staff ? Number(staff.id ?? 0) : null;
  const normalizedTime = normalizeTime(time);
  const start = `${date} ${normalizedTime}:00`;
  const plan = await planAppointmentServices({
    slug,
    serviceName,
    serviceNames,
    operatorStaffId,
    cabinId,
    staffMap,
    cabinMap,
    start,
  });
  const end = plan.end;
  const token = (holdToken ?? "").trim();
  if (token) {
    await assertDbAppointmentHold({
      slug,
      token,
      ownerKey: "manage",
      startsAt: start,
      serviceId: Number(plan.primaryService.id ?? 0),
      staffId: operatorStaffId,
      locationId,
    });
  }
  // Double-booking guard: refuse to move/edit onto a slot where an operator is
  // already busy. Exclude THIS appointment (so it doesn't conflict with its own
  // existing row/staff) and its own active hold. Best-effort: only a real detected
  // overlap throws (the route turns it into { ok:false, error }).
  await assertAppointmentSlotAvailable({
    slug,
    date,
    segments: plan.segments.map((seg) => ({ staffId: seg.staffId, startsAt: seg.startsAt, endsAt: seg.endsAt, locationId })),
    excludeAppointmentId: id,
    excludeHoldToken: token || null,
  });

  await tenantUpdate({
    slug,
    table: "appointments",
    id,
    values: {
      client_id: client.id,
      service_id: plan.primaryService.id,
      cabin_id: plan.primaryCabinId,
      starts_at: start,
      ends_at: end,
      location_id: locationId,
      staff_notes: staffNotes || null,
      customer_notes: customerNotes || null,
    },
  });

  // Replace the snapshot child rows so the edit reflects the new
  // service/staff/location/segment rather than stacking on the originals.
  await deleteAppointmentChildren(slug, "appointment_services", id);
  await deleteAppointmentChildren(slug, "appointment_staff", id);
  await deleteAppointmentChildren(slug, "appointment_locations", id);
  await deleteAppointmentChildren(slug, "appointment_segments", id);

  // One appointment_services snapshot row per selected service (ordered).
  for (const service of plan.services) await insertAppointmentService(slug, id, service);
  // Distinct staff across all services (single operator + per-service staff).
  for (const staffId of plan.staffIds) await insertAppointmentStaff(slug, id, staffId);
  if (locationId) await insertAppointmentLocation(slug, id, locationId);
  // Sequential segments: position 0..n, each from cursor to cursor+duration.
  for (const [position, seg] of plan.segments.entries()) {
    await insertAppointmentSegment(slug, id, seg.service, seg.staffId, seg.startsAt, seg.endsAt, seg.durationMinutes, position, seg.cabinId);
  }
  // PACKAGE redeem is intentionally NOT applied on edit: this update DELETES and
  // re-inserts appointment_services on every save, so re-applying a redeem here
  // would consume the package session AGAIN on each edit (over-consumption). The
  // quick-booking drawer only ever CREATES appointments (it never sends
  // package_redeem with an edit id), so `packageRedeems` is accepted for signature
  // parity but ignored here. TODO(edit redeem): port the legacy
  // reserve-on-save/consume-on-done + redeemed_at idempotency before consuming on
  // edit, so re-saves don't double-decrement.
  if (token) await markDbAppointmentHoldConverted(slug, token, "manage", id);

  const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Appuntamento non trovato.");
  return mapAppointment(slug, rows[0]);
}

// Snapshot of the customer-visible fields used to decide whether the legacy
// 'modified' email should fire. The PHP signature is far richer, but the Next
// edit path only touches date/time/services, so the route compares this compact
// shape before/after the update (appointment_customer_change_signature subset).
export type AppointmentCustomerVisibleSnapshot = {
  date: string;
  time: string;
  serviceNames: string[];
};

// Build the customer-visible snapshot (date/time + the appointment's service
// names) for an appointment, tenant-scoped. Returns null when the appointment
// does not belong to the tenant / does not exist, so the route can skip the
// 'modified' comparison entirely. Service names come from the appointment_services
// snapshot table, sorted so ordering never produces a false-positive change.
export async function getDbAppointmentCustomerVisibleSnapshot(slug: string, id: number): Promise<AppointmentCustomerVisibleSnapshot | null> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", columns: "starts_at", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) return null;
  const startsAt = toDate(rows[0].starts_at);
  let serviceNames: string[] = [];
  try {
    const serviceRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointment_services",
      columns: "service_name",
      where: "appointment_id = ?",
      params: [id],
      orderBy: "service_name ASC, id ASC",
    });
    serviceNames = serviceRows.map((row) => String(row.service_name ?? "").trim()).filter(Boolean).sort();
  } catch {
    // Older installs without the snapshot table: fall back to an empty list so
    // the comparison still works (only date/time changes will trigger the email).
  }
  return { date: dateIsoLocal(startsAt), time: timeLocal(startsAt), serviceNames };
}

// Move-snapshot: the fields a calendar drag/move needs to PRESERVE while only the
// slot (date/time/staff/location) changes. The calendar move action does not touch
// client/service/notes, so it re-feeds these existing values to updateDbAppointment
// (which keeps notes and recomputes the end from the service duration). Returns null
// when the appointment is not the tenant's / does not exist, plus the current PHP
// status so the route can mirror the legacy guard (only pending/scheduled movable).
export type AppointmentMoveSnapshot = {
  clientName: string;
  serviceName: string;
  operator: string;
  locationId: number | null;
  staffNotes: string | null;
  customerNotes: string | null;
  phpStatus: string;
};

export async function getDbAppointmentMoveSnapshot(slug: string, id: number): Promise<AppointmentMoveSnapshot | null> {
  // Tenant-scoped read: only returns the row when it belongs to this tenant.
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointments",
    columns: "id, client_id, service_id, location_id, status, staff_notes, customer_notes",
    where: "id = ?",
    params: [id],
    limit: 1,
  });
  const row = rows[0];
  if (!row) return null;

  const clientName = await appointmentClientName(slug, Number(row.client_id ?? 0));
  const service = await appointmentService(slug, row);
  const operator = await appointmentStaffName(slug, Number(row.id ?? 0));

  return {
    clientName,
    serviceName: service.name,
    operator,
    locationId: row.location_id === null || row.location_id === undefined ? null : Number(row.location_id),
    staffNotes: row.staff_notes === null || row.staff_notes === undefined ? null : String(row.staff_notes),
    customerNotes: row.customer_notes === null || row.customer_notes === undefined ? null : String(row.customer_notes),
    phpStatus: phpStatus(String(row.status ?? "")),
  };
}

// True when any customer-visible field differs between the before/after
// snapshots — i.e. the date, the time, or the set of service names changed.
// Mirrors automation_handle_customer_visible_change's "$after !== $before" gate,
// restricted to the fields the Next edit path can touch.
export function appointmentCustomerVisibleChanged(
  before: AppointmentCustomerVisibleSnapshot,
  after: AppointmentCustomerVisibleSnapshot,
): boolean {
  if (before.date !== after.date) return true;
  if (before.time !== after.time) return true;
  if (before.serviceNames.length !== after.serviceNames.length) return true;
  return before.serviceNames.some((name, index) => name !== after.serviceNames[index]);
}

// Delete every child row for an appointment (by appointment_id, tenant-scoped),
// used by updateDbAppointment to replace the service/staff/location/segment
// snapshots. Errors are swallowed for compatibility with older installs that may
// not have a given child table (matching the insertAppointment* helpers).
async function deleteAppointmentChildren(slug: string, baseTable: string, appointmentId: number): Promise<void> {
  try {
    const target = await tenantTable(slug, baseTable);
    const clauses = ["appointment_id = ?"];
    const params: unknown[] = [appointmentId];
    if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
      clauses.push("tenant_id = ?");
      params.push(target.tenantId ?? 0);
    }
    await dbExecute(`DELETE FROM ${quoteIdentifier(target.name)} WHERE ${clauses.join(" AND ")}`, params);
  } catch {
    // compatibility: table may not exist in older installs.
  }
}

export async function updateDbAppointmentStatus(slug: string, id: number, status: AppointmentStatus | string): Promise<AppointmentWithMeta> {
  await tenantUpdate({ slug, table: "appointments", id, values: { status: phpStatus(status) } });
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Appuntamento non trovato.");
  return mapAppointment(slug, rows[0]);
}

// Returns the appointment's current PHP-normalized status code ('pending',
// 'scheduled', 'canceled', 'done', 'no_show', ...) or null when not found. Used
// by the manage route to detect the status transition that triggers the
// approved/rejected lifecycle email, before updateDbAppointmentStatus writes the
// new status.
export async function getDbAppointmentPhpStatus(slug: string, id: number): Promise<string | null> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", columns: "status", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) return null;
  return phpStatus(String(rows[0].status ?? ""));
}

// Exported so the manage route can normalize the incoming target status to the
// same PHP code the DB write uses, then map old->new to a lifecycle email kind.
export function appointmentPhpStatus(status: AppointmentStatus | string): string {
  return phpStatus(status);
}

export async function listDbSales({
  slug,
  locationId = 0,
  includeCancelled = true,
}: {
  slug: string;
  locationId?: number;
  includeCancelled?: boolean;
}): Promise<PosSale[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (locationId > 0) {
    clauses.push("(location_id IS NULL OR location_id = ?)");
    params.push(locationId);
  }
  if (!includeCancelled) clauses.push("status <> 'cancelled'");

  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sales",
    where: clauses.join(" AND "),
    params,
    orderBy: "sale_date DESC, id DESC",
  });

  return Promise.all(rows.map((row) => mapSale(slug, row)));
}

export async function posDbSummary(slug: string): Promise<PosSummary> {
  const sales = await listDbSales({ slug });
  const activeSales = sales.filter((sale) => sale.status !== "cancelled");
  const cancelledSales = sales.filter((sale) => sale.status === "cancelled");
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
    paymentTotals.card = roundMoney(paymentTotals.card + sale.total);
    for (const item of sale.items) {
      if (item.type === "service") serviceTotal = roundMoney(serviceTotal + item.total);
      if (item.type === "product") productTotal = roundMoney(productTotal + item.total);
    }
  }

  return {
    saleCount: activeSales.length,
    grossTotal: roundMoney(sales.reduce((total, sale) => total + sale.total, 0)),
    activeTotal: roundMoney(activeSales.reduce((total, sale) => total + sale.total, 0)),
    cancelledTotal: roundMoney(cancelledSales.reduce((total, sale) => total + sale.total, 0)),
    paymentTotals,
    serviceTotal,
    productTotal,
  };
}

export async function checkoutDbSale(input: PosCheckoutInput, slug: string): Promise<PosSale> {
  if (!input.items.length) throw new Error("Carrello vuoto.");
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const items = await Promise.all(input.items.map((item, index) => buildDbSaleItem(slug, item, index + 1)));
  const subtotal = roundMoney(items.reduce((total, item) => total + item.total, 0));
  const discount = roundMoney(Math.max(0, input.discount ?? 0));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const paidAmount = roundMoney(input.payments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0));
  if (paidAmount + 0.00001 < total) throw new Error("Pagamento insufficiente.");

  for (const item of items) {
    if (item.type === "product" && item.refId > 0) {
      const product = await getSingleProduct(slug, item.refId);
      if (product.stock < item.quantity) throw new Error(`Giacenza insufficiente per ${product.name}.`);
    }
  }

  const saleTable = await tenantTable(slug, "sales");
  const saleId = await tenantInsert(saleTable, {
    client_id: client.id > 0 ? client.id : null,
    sale_date: new Date(),
    subtotal,
    discount,
    total,
    coupon_code: input.couponCode || null,
    notes: input.appointmentId ? `Appuntamento #${input.appointmentId}` : null,
    status: "done",
    location_id: input.locationId && input.locationId > 0 ? input.locationId : null,
    promotion_applied_id: input.promotionId && input.promotionId > 0 ? input.promotionId : null,
  });

  for (const item of items) {
    const saleItemId = await tenantInsert(await tenantTable(slug, "sale_items"), {
      sale_id: saleId,
      item_type: item.type === "product" ? "product" : "service",
      item_id: item.refId > 0 ? item.refId : null,
      item_name: item.name,
      qty: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.total,
      item_status: item.status,
    });

    if (item.type === "product" && item.refId > 0 && item.status !== "ordered") {
      await decrementProductStock(slug, item.refId, item.quantity);
    }
    if (item.type === "prepaid" && client.id > 0) {
      await issueDbPrepaidFromSale({ slug, saleId, saleItemId, clientId: client.id, item });
    }
    if (item.type === "package" && client.id > 0) {
      await issueDbPackageFromSale({ slug, saleId, clientId: client.id, item });
    }
    if (item.type === "giftcard" && client.id > 0) {
      await issueDbGiftCardFromSale({ slug, clientId: client.id, recipientName: client.name, amount: item.total, locationId: input.locationId ?? null });
    }
  }

  if (input.appointmentId && input.appointmentId > 0) {
    await tenantUpdate({ slug, table: "appointments", id: input.appointmentId, values: { status: "done" } }).catch(() => 0);
  }
  if (input.installments && input.installments > 1 && client.id > 0) {
    await createDbInstallmentPlanFromSale({ slug, saleId, clientId: client.id, total, count: input.installments });
  }

  const sales = await listDbSales({ slug });
  const sale = sales.find((item) => item.id === saleId);
  if (!sale) throw new Error("Vendita creata ma non riletta.");
  return sale;
}

export async function cancelDbSale({
  saleId,
  reason,
  stockCancelMode = "restore",
  slug,
}: {
  saleId: number;
  reason: string;
  stockCancelMode?: "restore" | "no_restore" | "none";
  slug: string;
}): Promise<PosSale> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sales", where: "id = ?", params: [saleId], limit: 1 });
  const saleRow = rows[0];
  if (!saleRow) throw new Error("Vendita non trovata.");
  if (String(saleRow.status ?? "") === "cancelled") throw new Error("Vendita gia annullata.");
  const items = await saleItems(slug, saleId);

  if (stockCancelMode === "restore") {
    for (const item of items) {
      if (item.type === "product" && item.refId > 0) await incrementProductStock(slug, item.refId, item.quantity);
    }
  }

  await tenantUpdate({
    slug,
    table: "sales",
    id: saleId,
    values: { status: "cancelled", cancelled_at: new Date(), cancelled_reason: reason || "Annullamento vendita" },
  });
  await cancelDbSaleResidues(slug, saleId);

  const sales = await listDbSales({ slug });
  const sale = sales.find((item) => item.id === saleId);
  if (!sale) throw new Error("Vendita annullata ma non riletta.");
  return sale;
}

export async function listDbCosts(slug: string): Promise<CostItem[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "costs",
    orderBy: "due_date ASC, id DESC",
  });
  return Promise.all(rows.map((row) => mapCost(slug, row)));
}

export async function costDbSummary(slug: string): Promise<{ open: number; overdue: number; paid: number; dueAmount: number }> {
  const costs = await listDbCosts(slug);
  return {
    open: costs.filter((cost) => cost.status === "open").length,
    overdue: costs.filter((cost) => cost.status === "overdue").length,
    paid: costs.filter((cost) => cost.status === "paid").length,
    dueAmount: roundMoney(costs.filter((cost) => cost.status !== "paid").reduce((total, cost) => total + cost.amount, 0)),
  };
}

export async function markDbCostPaid(id: number, slug: string): Promise<CostItem> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "costs", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Costo non trovato.");
  await tenantUpdate({ slug, table: "costs", id, values: { is_paid: 1, paid_amount: Number(rows[0].amount ?? 0), paid_at: new Date() } });
  const updatedRows = await tenantSelect<RowDataPacket>({ slug, table: "costs", where: "id = ?", params: [id], limit: 1 });
  if (!updatedRows[0]) throw new Error("Costo non trovato.");
  return mapCost(slug, updatedRows[0]);
}

export async function listDbQuotes(slug: string): Promise<Quote[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "quotes",
    orderBy: "created_at DESC, id DESC",
  });
  return Promise.all(rows.map((row) => mapQuote(slug, row)));
}

export async function createDbQuote(
  input: { clientId?: number; clientName?: string; lines: PosSaleItemInput[]; discount?: number },
  slug: string,
): Promise<Quote> {
  if (!input.lines.length) throw new Error("Aggiungi almeno una voce al preventivo.");
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const items = await Promise.all(input.lines.map((line, index) => buildDbSaleItem(slug, line, index + 1)));
  const subtotal = roundMoney(items.reduce((total, item) => total + item.total, 0));
  const discount = roundMoney(Math.min(subtotal, Math.max(0, input.discount ?? 0)));
  const total = roundMoney(Math.max(0, subtotal - discount));
  const tempNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
  const id = await tenantInsert(await tenantTable(slug, "quotes"), {
    number: tempNumber,
    client_id: client.id > 0 ? client.id : null,
    client_name: client.name,
    subtotal,
    discount_total: discount,
    total,
    status: "draft",
    public_token: randomHex(32),
    valid_until: addDaysDate(30),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await tenantUpdate({ slug, table: "quotes", id, values: { number: `Q-${String(id).padStart(5, "0")}` } }).catch(() => undefined);

  for (const [index, item] of items.entries()) {
    await tenantInsert(await tenantTable(slug, "quote_items"), {
      quote_id: id,
      item_type: item.type === "product" ? "product" : "service",
      item_id: item.refId > 0 ? item.refId : null,
      description: item.name,
      qty: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.total,
      position: index + 1,
    });
  }

  const rows = await tenantSelect<RowDataPacket>({ slug, table: "quotes", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Preventivo creato ma non riletta.");
  return mapQuote(slug, rows[0]);
}

export async function updateDbQuoteStatus(id: number, status: QuoteStatus, slug: string): Promise<Quote> {
  const values: Record<string, unknown> = { status };
  if (status === "sent") values.sent_at = new Date();
  if (status === "accepted") {
    values.customer_decision_at = new Date();
    values.customer_decision_source = "next";
  }
  await tenantUpdate({ slug, table: "quotes", id, values });
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "quotes", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Preventivo non trovato.");
  return mapQuote(slug, rows[0]);
}

// Port of the quotes.php manual "Invia email" action (action=email): emails the
// quote to the client with the public-page link and a PDF link, then marks the
// quote sent. The Next quotes route previously only flipped the status via
// updateDbQuoteStatus(), so the email was silent. This sends it for real.
//
// Tenant-scoped, gated on emailConfigured() (no-op when SES is off so the existing
// status-only behaviour is preserved), runs AFTER the status write, and swallows
// every error — a failed send must never fail the quotes flow (the legacy redirects
// with an error but the row stays; here the caller already updated the status).
//
// Recipient resolution mirrors the PHP: explicit `toEmail` (the form's to_email),
// else the quote's stored client_email, else the linked client's email.
//
// TODO (PDF): the legacy links a server-rendered PDF (QuotePdf.php) at
// ?page=quote_public&token=...&format=pdf. There is no PDF renderer in Next yet, so
// we keep the legacy public/PDF link shapes built against PRENODO_PUBLIC_BASE_URL
// (the tenant's legacy public site still serves quote_public). Replace these with
// the native public quote page + PDF once they exist in Next.
type QuoteBranding = { name: string; email: string; logoUrl: string };

async function quoteEmailBranding(slug: string): Promise<QuoteBranding> {
  const empty: QuoteBranding = { name: "", email: "", logoUrl: "" };
  try {
    const tenantId = await tenantIdForSlug(slug);
    if (!tenantId || !(await tableExists("businesses"))) return empty;
    const hasLogo = await columnExists("businesses", "logo_path");
    const hasQuoteName = await columnExists("businesses", "quote_company_name");
    const hasQuoteEmail = await columnExists("businesses", "quote_email");
    const cols = ["name", "email"];
    if (hasQuoteName) cols.push("quote_company_name");
    if (hasQuoteEmail) cols.push("quote_email");
    if (hasLogo) cols.push("logo_path");
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${cols.join(", ")} FROM businesses WHERE tenant_id = ? ORDER BY id ASC LIMIT 1`,
      [tenantId],
    ).catch(() => [] as RowDataPacket[]);
    const row = rows[0];
    if (!row) return empty;
    // The legacy quote header uses the quote-specific company name/email when set
    // (quote_apply_location_snapshot_to_header), falling back to the business ones.
    const name = String(row.quote_company_name ?? "").trim() || String(row.name ?? "");
    const fromEmail = String(row.quote_email ?? "").trim() || String(row.email ?? "");
    return {
      name,
      email: fromEmail,
      logoUrl: hasLogo ? resolveQuoteLogoUrl(String(row.logo_path ?? "")) : "",
    };
  } catch {
    return empty;
  }
}

function resolveQuoteLogoUrl(logoPath: string): string {
  const path = logoPath.trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(process.env.PRENODO_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base || !path.startsWith("/")) return "";
  return `${base}${path}`;
}

// quote_public_url() / quote_public_pdf_url(): the legacy tenant public links.
function quotePublicUrl(slug: string, token: string): string {
  const base = String(process.env.PRENODO_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base || !token) return "";
  return `${base}/${encodeURIComponent(slug)}/index.php?page=quote_public&token=${encodeURIComponent(token)}&embed=1`;
}
function quotePublicPdfUrl(slug: string, token: string): string {
  const base = String(process.env.PRENODO_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base || !token) return "";
  return `${base}/${encodeURIComponent(slug)}/index.php?page=quote_public&token=${encodeURIComponent(token)}&format=pdf`;
}

function escapeQuoteHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// date('d/m/Y', strtotime($valid_until)) over a stored Y-m-d (or Y-m-d HH:MM:SS).
function formatQuoteValidUntil(raw: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export async function sendQuoteEmail(
  id: number,
  slug: string,
  opts: { toEmail?: string; message?: string } = {},
): Promise<void> {
  if (!emailConfigured()) return;
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "quotes", where: "id = ?", params: [id], limit: 1 }).catch(() => []);
    const quote = rows[0];
    if (!quote) return;

    // Recipient: explicit to_email -> quote.client_email -> linked client email.
    let to = String(opts.toEmail ?? "").trim();
    if (!to) to = String(quote.client_email ?? "").trim();
    if (!to) {
      const clientId = Number(quote.client_id ?? 0);
      if (clientId > 0) {
        const clientRows = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "email", where: "id = ?", params: [clientId], limit: 1 }).catch(() => []);
        to = String(clientRows[0]?.email ?? "").trim();
      }
    }
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

    const token = String(quote.public_token ?? "").trim();
    const publicUrl = quotePublicUrl(slug, token);
    const pdfUrl = quotePublicPdfUrl(slug, token);

    const branding = await quoteEmailBranding(slug);
    const bizName = branding.name.trim();
    const number = String(quote.number ?? "");
    const clientName = String(quote.client_name ?? "").trim();
    const customMsg = String(opts.message ?? "").trim();

    // Subject: 'Preventivo <number>' + ' - <bizName>' when present.
    let subject = `Preventivo ${number}`.trim();
    if (bizName !== "") subject += ` - ${bizName}`;

    // Body: faithful HTML port of the quotes.php block (greeting, number, validity,
    // optional custom message box, "Apri preventivo" button, PDF link).
    let body = "";
    body += clientName !== ""
      ? `Ciao <strong>${escapeQuoteHtml(clientName)}</strong>,<br><br>`
      : "Ciao,<br><br>";
    body += `ti inviamo il tuo preventivo <strong>#${escapeQuoteHtml(number)}</strong>.`;
    const validUntil = formatQuoteValidUntil(quote.valid_until);
    if (validUntil !== "") {
      body += `<br>Valido fino al: <strong>${escapeQuoteHtml(validUntil)}</strong>.`;
    }
    body += "<br><br>";
    if (customMsg !== "") {
      const safeMsg = escapeQuoteHtml(customMsg).replace(/(\r\n|\n\r|\n|\r)/g, "<br>$1");
      body += `<div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:10px 0;white-space:pre-wrap;">${safeMsg}</div>`;
    }
    if (publicUrl !== "") {
      body += `<a href="${escapeQuoteHtml(publicUrl)}" style="display:inline-block;background:#4e6da5;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600">Apri preventivo</a>`;
      body += "<br><br>";
    }
    if (pdfUrl !== "") {
      body += `Scarica PDF: <a href="${escapeQuoteHtml(pdfUrl)}">${escapeQuoteHtml(pdfUrl)}</a><br>`;
    }

    const { html, text } = buildModernEmailTemplate(subject, body, {
      business_name: bizName,
      business_email: branding.email,
      business_logo_url: branding.logoUrl,
    });
    const res = await sendEmail({
      to,
      subject,
      html,
      text,
      fromEmail: branding.email.trim() || undefined,
      fromName: bizName || undefined,
    });
    if (!res.ok) {
      console.error(`[db-repositories] quote email send failed for quote ${id} -> ${to}: ${res.error}`);
      return;
    }

    // Legacy best-effort "mark sent": draft -> sent, stamp sent_at + sent_to_email.
    const quoteTable = await tenantTable(slug, "quotes");
    const values: Record<string, unknown> = {};
    if (String(quote.status ?? "") === "draft") values.status = "sent";
    if (await columnExists(quoteTable.name, "sent_at")) values.sent_at = new Date();
    if (await columnExists(quoteTable.name, "sent_to_email")) values.sent_to_email = to;
    if (await columnExists(quoteTable.name, "updated_at")) values.updated_at = new Date();
    if (Object.keys(values).length > 0) {
      await tenantUpdate({ slug, table: "quotes", id, values }).catch(() => undefined);
    }
  } catch (error) {
    console.error("[db-repositories] quote email send error:", error);
  }
}

export async function convertDbQuoteToSale(id: number, slug: string, locationId = 0): Promise<{ quote: Quote; sale: PosSale }> {
  const quote = (await listDbQuotes(slug)).find((item) => item.id === id);
  if (!quote) throw new Error("Preventivo non trovato.");
  if (quote.status === "converted") throw new Error("Preventivo gia convertito.");

  const sale = await checkoutDbSale({
    clientId: quote.clientId,
    clientName: quote.clientName,
    locationId,
    discount: quote.discount,
    items: quote.lines.map((line) => ({
      type: line.type,
      refId: line.refId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    payments: quote.total > 0 ? [{ method: "card", amount: quote.total }] : [],
  }, slug);

  const quoteTable = await tenantTable(slug, "quotes");
  const values: Record<string, unknown> = { status: "converted" };
  if (await columnExists(quoteTable.name, "converted_sale_id")) values.converted_sale_id = sale.id;
  if (await columnExists(quoteTable.name, "converted_at")) values.converted_at = new Date();
  if (await columnExists(quoteTable.name, "updated_at")) values.updated_at = new Date();
  await tenantUpdate({ slug, table: "quotes", id, values });

  const updated = (await listDbQuotes(slug)).find((item) => item.id === id);
  if (!updated) throw new Error("Preventivo convertito ma non riletta.");
  return { quote: updated, sale };
}

export async function listDbWalletMovements(slug: string): Promise<WalletMovement[]> {
  const movements: WalletMovement[] = [];

  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "transactions",
      orderBy: "created_at DESC, id DESC",
      limit: 400,
    });
    movements.push(...rows.map(mapTransactionMovement));
  } catch {
    // Fidelity can be disabled in older installs.
  }

  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "credit_adjustments",
      orderBy: "created_at DESC, id DESC",
      limit: 400,
    });
    movements.push(...rows.map(mapCreditAdjustmentMovement));
  } catch {
    // Wallet can be disabled in older installs.
  }

  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "recharges",
      where: "COALESCE(is_void, 0) = 0",
      orderBy: "created_at DESC, id DESC",
      limit: 400,
    });
    movements.push(...rows.map(mapRechargeMovement));
  } catch {
    // Recharge table is optional.
  }

  return movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
}

export async function dbWalletBalance(clientId: number, slug: string): Promise<{ credit: number; points: number }> {
  if (clientId <= 0) return { credit: 0, points: 0 };
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "clients",
    columns: "credit_balance,points",
    where: "id = ?",
    params: [clientId],
    limit: 1,
  });
  return {
    credit: roundMoney(Number(rows[0]?.credit_balance ?? 0)),
    points: Math.round(Number(rows[0]?.points ?? 0)),
  };
}

export async function addDbWalletMovement(input: Partial<WalletMovement>, slug: string): Promise<WalletMovement> {
  const clientId = Math.max(0, Number(input.clientId ?? 0));
  if (clientId <= 0) throw new Error("Cliente mancante.");
  const type = normalizeWalletMovementType(input.type);
  const amount = roundMoney(Number(input.amount ?? 0));
  const points = Math.round(Number(input.points ?? 0));
  if (amount === 0 && points === 0) throw new Error("Movimento vuoto.");

  const note = normalizeName(input.note, "Movimento wallet");
  const before = await dbWalletBalance(clientId, slug);
  let source = "manual";
  let id = 0;

  if (amount !== 0) {
    const balanceAfter = roundMoney(before.credit + amount);
    id = await tenantInsert(await tenantTable(slug, "credit_adjustments"), {
      client_id: clientId,
      direction: amount >= 0 ? "credit" : "debit",
      amount: Math.abs(amount),
      delta_amount: amount,
      balance_before: before.credit,
      balance_after: balanceAfter,
      note,
      created_at: new Date(),
    });
    await tenantUpdate({ slug, table: "clients", id: clientId, values: { credit_balance: balanceAfter } });
    source = "credit_adjustments";
  }

  if (points !== 0) {
    const nextPoints = before.points + points;
    const transactionId = await tenantInsert(await tenantTable(slug, "transactions"), {
      client_id: clientId,
      kind: type === "points_redeem" ? "redeem" : type === "points_earn" ? "earn" : "manual",
      source_type: input.source ?? source,
      delta_points: points,
      amount: amount || null,
      note,
      created_at: new Date(),
    });
    if (!id) id = transactionId;
    await tenantUpdate({ slug, table: "clients", id: clientId, values: { points: nextPoints } });
    source = "transactions";
  }

  return {
    id,
    clientId,
    type,
    amount,
    points,
    note,
    source,
    createdAt: new Date().toISOString(),
  };
}

export async function listDbGiftCards(slug: string): Promise<GiftCard[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "giftcards",
    orderBy: "issued_at DESC, id DESC",
  });
  return rows.map(mapGiftCard);
}

export async function issueDbGiftCard(input: Partial<GiftCard>, slug: string): Promise<GiftCard> {
  const amount = roundMoney(Math.max(0, Number(input.initialAmount ?? input.balance ?? 0)));
  if (amount <= 0) throw new Error("Importo GiftCard non valido.");

  const id = await tenantInsert(await tenantTable(slug, "giftcards"), {
    voucher_public_token: randomHex(64),
    code: normalizeName(input.code, `GC${Date.now().toString(36).toUpperCase().slice(-8)}`).toUpperCase().slice(0, 24),
    client_id: input.clientId && input.clientId > 0 ? input.clientId : null,
    recipient_name: normalizeName(input.recipientName, "Destinatario"),
    initial_amount: amount,
    balance: amount,
    currency: "EUR",
    status: "active",
    issued_at: new Date(),
    expires_at: input.expiresAt ?? addDaysDate(365),
    note: input.sourceSaleId ? `Vendita #${input.sourceSaleId}` : null,
  });

  await tenantInsert(await tenantTable(slug, "giftcard_transactions"), {
    giftcard_id: id,
    type: "issue",
    amount,
    note: "Emissione GiftCard",
    created_at: new Date(),
  });

  return getSingleGiftCard(slug, id);
}

export async function redeemDbGiftCard(id: number, amount: number, slug: string): Promise<GiftCard> {
  const giftCard = await getSingleGiftCard(slug, id);
  if (giftCard.status !== "active") throw new Error("GiftCard non utilizzabile.");
  const value = roundMoney(Math.max(0, amount));
  if (value <= 0 || value > giftCard.balance) throw new Error("Importo riscatto non valido.");

  const balance = roundMoney(giftCard.balance - value);
  await tenantUpdate({
    slug,
    table: "giftcards",
    id,
    values: {
      balance,
      status: balance <= 0 ? "redeemed" : "active",
      redeemed_at: balance <= 0 ? new Date() : undefined,
    },
  });
  await tenantInsert(await tenantTable(slug, "giftcard_transactions"), {
    giftcard_id: id,
    type: "redeem",
    amount: value,
    note: "Riscatto GiftCard",
    created_at: new Date(),
  });

  return getSingleGiftCard(slug, id);
}

export async function listDbPackageState(slug: string): Promise<{ catalog: PackageCatalog[]; clientPackages: ClientPackage[] }> {
  const catalogRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "packages",
    where: "COALESCE(is_active, 1) = 1",
    orderBy: "name ASC, id DESC",
  });
  const clientRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "client_packages",
    orderBy: "created_at DESC, id DESC",
  });

  return {
    catalog: await Promise.all(catalogRows.map((row) => mapPackageCatalog(slug, row))),
    clientPackages: await Promise.all(clientRows.map((row) => mapClientPackage(slug, row))),
  };
}

export async function issueDbClientPackage(
  input: { packageId?: number; clientId?: number; clientName?: string; expiresAt?: string; sourceSaleId?: number },
  slug: string,
): Promise<ClientPackage> {
  const catalogRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "packages",
    where: input.packageId && input.packageId > 0 ? "id = ? AND COALESCE(is_active, 1) = 1" : "COALESCE(is_active, 1) = 1",
    params: input.packageId && input.packageId > 0 ? [input.packageId] : [],
    orderBy: "id ASC",
    limit: 1,
  });
  if (!catalogRows[0]) throw new Error("Pacchetto non trovato.");

  const catalog = await mapPackageCatalog(slug, catalogRows[0]);
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const totalSessions = Math.max(1, catalog.items.reduce((total, item) => total + item.sessions, 0) || Number(catalogRows[0].sessions_total ?? 1));
  const expiresAt = input.expiresAt ?? addDaysDate(Number(catalogRows[0].validity_days ?? 180) || 180);
  const id = await tenantInsert(await tenantTable(slug, "client_packages"), {
    client_id: client.id,
    package_id: catalog.id,
    package_name: catalog.name,
    service_id: Number(catalogRows[0].service_id ?? 0) || null,
    purchase_date: todayIso(),
    start_date: todayIso(),
    expires_at: expiresAt,
    sessions_total: totalSessions,
    sessions_remaining: totalSessions,
    status: "active",
    sale_id: input.sourceSaleId && input.sourceSaleId > 0 ? input.sourceSaleId : null,
  });
  await insertClientPackageItemsFromCatalog(slug, id, catalog);

  return getSingleClientPackage(slug, id);
}

export async function consumeDbClientPackage(id: number, sessions: number, slug: string): Promise<ClientPackage> {
  const current = await getSingleClientPackage(slug, id);
  if (current.status !== "active") throw new Error("Pacchetto non utilizzabile.");
  const quantity = Math.max(1, Math.round(sessions));
  if (current.remainingSessions < quantity) throw new Error("Sedute pacchetto insufficienti.");
  const remaining = current.remainingSessions - quantity;
  await tenantUpdate({
    slug,
    table: "client_packages",
    id,
    values: { sessions_remaining: remaining, status: remaining <= 0 ? "completed" : "active" },
  });
  await tryInsertPackageUsage(slug, id, -quantity, "Consumo manuale pacchetto");
  return getSingleClientPackage(slug, id);
}

// One entry from the quick-booking `package_redeem` JSON array (assets/js/app.js
// qbReadPackageRedeem): apply a client's prepaid package to a service so that
// service is covered (a session is consumed, no charge). `clientPackageServiceId`
// is optional — it pins the exact `client_package_services` row when sent.
export type AppointmentPackageRedeem = {
  clientPackageId: number;
  serviceId: number;
  clientPackageServiceId?: number | null;
};

// Apply the quick-booking PACKAGE redeems for an appointment AS PART of the save.
// For each requested redeem this RE-VALIDATES server-side (never trusting the
// client): the package belongs to the appointment's client, is active + not
// expired, has sessions_remaining > 0, and COVERS the service (a
// client_package_services row for that service with its own sessions_remaining,
// or the legacy single client_packages.service_id). On success it consumes ONE
// session — decrementing the per-service `client_package_services` pool (when
// present) AND the package-level `client_packages` pool via consumeDbClientPackage
// (which flips status to 'completed' at 0 and writes the usage ledger) — and links
// the matching appointment_services row (client_package_id /
// client_package_service_id) while zeroing its charge (price 0, list_price kept,
// 'Pacchetto' badge). A redeem that fails validation is SKIPPED (collected as a
// warning) and never fails the whole booking; the non-redeem path is untouched.
//
// Faithful to api_appointments.php + ClientPackages.php (saveAppointmentSelection
// validation + redeemAppointmentSelectionIfAny consumption), adapted to the Next
// port's instruction to link on the appointment_services row and consume at save
// time. TODO(parity): the legacy RESERVES on save and only consumes on status
// 'done' (with reservation conflict checks across other active bookings) and
// rolls back on cancel; here we consume immediately on save and do not reconcile
// on later status changes.
export async function applyAppointmentPackageRedeems({
  slug,
  appointmentId,
  clientId,
  serviceIds,
  redeems,
}: {
  slug: string;
  appointmentId: number;
  clientId: number;
  serviceIds: number[]; // service_ids actually on this appointment (the redeem is filtered to these)
  redeems: AppointmentPackageRedeem[];
}): Promise<{ applied: AppointmentPackageRedeem[]; warnings: string[] }> {
  const applied: AppointmentPackageRedeem[] = [];
  const warnings: string[] = [];
  if (!redeems.length) return { applied, warnings };

  // Only the appointment_services snapshot table can carry the linkage; if it
  // lacks the package columns (older installs) we still consume + log a warning.
  const servicesTable = await tenantTable(slug, "appointment_services").catch(() => null);
  const hasLinkColumns = servicesTable
    ? (await columnExists(servicesTable.name, "client_package_id")) &&
      (await columnExists(servicesTable.name, "client_package_service_id"))
    : false;

  // Drop redeems for services not on this appointment, and dedupe so a service is
  // covered by at most ONE package (first wins) — mirrors the legacy per-service
  // selection map (qb_filter_selection_by_current_services + bySvc map).
  const onAppointment = new Set(serviceIds.filter((id) => id > 0));
  const seenService = new Set<number>();

  for (const redeem of redeems) {
    const clientPackageId = Number(redeem.clientPackageId ?? 0);
    const serviceId = Number(redeem.serviceId ?? 0);
    if (clientPackageId <= 0 || serviceId <= 0) continue;
    if (!onAppointment.has(serviceId)) continue; // service not on the appointment
    if (seenService.has(serviceId)) continue; // already covered by another package
    seenService.add(serviceId);

    try {
      // 1) Load the package, tenant-scoped (tenantSelect scopes to the tenant).
      const packageRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "client_packages",
        columns: "id, client_id, package_name, status, expires_at, sessions_remaining, service_id",
        where: "id = ?",
        params: [clientPackageId],
        limit: 1,
      });
      const pkg = packageRows[0];
      if (!pkg) {
        warnings.push("Pacchetto non trovato.");
        continue;
      }

      // 2) Ownership: the package must belong to the appointment's client.
      if (Number(pkg.client_id ?? 0) !== clientId) {
        warnings.push("Il pacchetto selezionato non appartiene al cliente.");
        continue;
      }

      // 3) Active + not expired + remaining > 0 (effective status, like pkgStatusCalc).
      const remaining = Math.max(0, Number(pkg.sessions_remaining ?? 0));
      const expiresYmd = pkg.expires_at ? String(pkg.expires_at).slice(0, 10) : "";
      const effectiveStatus = clientPackageStatus(String(pkg.status ?? "active"), remaining, expiresYmd);
      if (effectiveStatus !== "active") {
        warnings.push(`Pacchetto ${String(pkg.package_name ?? "")} non utilizzabile (${effectiveStatus}).`.trim());
        continue;
      }
      if (remaining <= 0) {
        warnings.push("Sedute pacchetto esaurite.");
        continue;
      }

      // 4) Coverage: prefer a per-service client_package_services row (with its own
      //    sessions_remaining > 0); fall back to the legacy single service_id.
      let coverageRowId: number | null = null;
      let coverageRemaining: number | null = null;
      let hasAnyCoverageRows = false;
      try {
        const coverageRows = await tenantSelect<RowDataPacket>({
          slug,
          table: "client_package_services",
          columns: "id, sessions_remaining",
          where: "client_package_id = ? AND service_id = ?",
          params: [clientPackageId, serviceId],
          orderBy: "sort_order ASC, id ASC",
          limit: 1,
        });
        if (coverageRows[0]) {
          coverageRowId = Number(coverageRows[0].id ?? 0) || null;
          coverageRemaining = Math.max(0, Number(coverageRows[0].sessions_remaining ?? 0));
        }
        // Does this package have ANY per-service rows at all?
        const anyRows = await tenantSelect<RowDataPacket>({
          slug,
          table: "client_package_services",
          columns: "id",
          where: "client_package_id = ?",
          params: [clientPackageId],
          limit: 1,
        });
        hasAnyCoverageRows = anyRows.length > 0;
      } catch {
        // table absent -> treat as legacy single-service package
      }

      if (coverageRowId === null) {
        if (hasAnyCoverageRows) {
          // Package is multi-service but does not include this service -> not covered.
          warnings.push("Servizio non incluso nel pacchetto selezionato.");
          continue;
        }
        // Legacy single-service package: the cp.service_id must match (when set).
        const legacyServiceId = Number(pkg.service_id ?? 0);
        if (legacyServiceId > 0 && legacyServiceId !== serviceId) {
          warnings.push("Servizio non incluso nel pacchetto selezionato.");
          continue;
        }
      } else if (coverageRemaining !== null && coverageRemaining <= 0) {
        // Per-service pool exhausted even though the package-level pool is not.
        warnings.push("Sedute pacchetto esaurite per il servizio selezionato.");
        continue;
      }

      // 5) Consume ONE session. Decrement the AUTHORITATIVE package-level pool FIRST
      //    via consumeDbClientPackage (it re-reads remaining and THROWS on
      //    insufficient sessions + flips status to 'completed' at 0 + writes the
      //    usage ledger) — so we never over-consume, and a failure here leaves the
      //    per-service pool untouched. Then mirror the decrement on the per-service
      //    client_package_services row, keeping package.remaining == SUM(cps.remaining)
      //    (the legacy recomputes the package total from the cps rows after redeem).
      await consumeDbClientPackage(clientPackageId, 1, slug);
      if (coverageRowId !== null && coverageRemaining !== null) {
        await tenantUpdate({
          slug,
          table: "client_package_services",
          id: coverageRowId,
          values: { sessions_remaining: Math.max(0, coverageRemaining - 1) },
        });
      }

      // 6) Link the appointment_services row + zero its charge (keep list_price).
      if (hasLinkColumns && servicesTable) {
        await updateAppointmentServicePackageLink(slug, servicesTable, appointmentId, serviceId, {
          clientPackageId,
          clientPackageServiceId: coverageRowId ?? redeem.clientPackageServiceId ?? null,
        });
      } else {
        warnings.push("Sessione pacchetto consumata, ma il collegamento al servizio non è disponibile su questo archivio.");
      }

      applied.push({ clientPackageId, serviceId, clientPackageServiceId: coverageRowId ?? null });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Errore riscatto pacchetto.");
    }
  }

  return { applied, warnings };
}

// Set the package linkage on a single appointment_services row (keyed by the
// composite appointment_id + service_id — the table has no surrogate id) and zero
// its charge: price 0, list_price preserved as the catalog reference, and a
// 'Pacchetto' discount_badge (faithful to the legacy zero-charge presentation).
async function updateAppointmentServicePackageLink(
  slug: string,
  table: TenantTable,
  appointmentId: number,
  serviceId: number,
  link: { clientPackageId: number; clientPackageServiceId: number | null },
): Promise<void> {
  const assignments: string[] = [
    "client_package_id = ?",
    "client_package_service_id = ?",
    "price = 0",
  ];
  const params: unknown[] = [link.clientPackageId, link.clientPackageServiceId];
  if (await columnExists(table.name, "discount_badge")) assignments.push("discount_badge = 'Pacchetto'");
  const clauses = ["appointment_id = ?", "service_id = ?"];
  params.push(appointmentId, serviceId);
  if (table.mode === "shared" && (await columnExists(table.name, "tenant_id"))) {
    clauses.push("tenant_id = ?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${assignments.join(", ")} WHERE ${clauses.join(" AND ")}`,
    params,
  );
}

// One entry from the quick-booking `prepaid_service_redeem` JSON array (assets/js/
// app.js qbReadPrepaidServiceRedeem): apply a client's prepaid-service balance to a
// service so that service is covered (one unit is consumed, no charge). A prepaid is
// tied to ONE service directly (client_prepaid_services.service_id), so there is no
// separate coverage row — the prepaid's service_id must equal the redeemed service.
export type AppointmentPrepaidRedeem = {
  clientPrepaidServiceId: number;
  serviceId: number;
};

// Apply the quick-booking PREPAID-SERVICE redeems for an appointment AS PART of the
// save. For each requested redeem this RE-VALIDATES server-side (never trusting the
// client): the prepaid exists, belongs to the appointment's client, is active + not
// expired, has remaining_qty > 0, and its service_id == the redeemed service (which
// must be on the appointment). On success it consumes ONE unit via consumeDbPrepaid
// (which re-reads remaining and THROWS on insufficient balance + flips status to
// 'completed' at 0 + writes the client_prepaid_service_usages ledger) and links the
// matching appointment_services row (client_prepaid_service_id) while zeroing its
// charge (price 0, list_price kept, 'Prepagato' badge). A redeem that fails
// validation is SKIPPED (collected as a warning) and never fails the whole booking.
//
// `coveredServiceIds` are the services already covered by a PACKAGE redeem in this
// same save — those are skipped so a service is covered at most once (dedupe). Like
// the package apply, we additionally dedupe so a service is prepaid-covered by at
// most one prepaid (first wins). Faithful to api_appointments.php +
// ClientPrepaidServices.php (saveAppointmentSelection validation +
// consume-on-save), adapted to the Next port's link-on-appointment_services_row.
export async function applyAppointmentPrepaidRedeems({
  slug,
  appointmentId,
  clientId,
  serviceIds,
  redeems,
  coveredServiceIds,
}: {
  slug: string;
  appointmentId: number;
  clientId: number;
  serviceIds: number[]; // service_ids actually on this appointment (the redeem is filtered to these)
  redeems: AppointmentPrepaidRedeem[];
  coveredServiceIds?: Set<number>; // services already covered by a package redeem (skip)
}): Promise<{ applied: AppointmentPrepaidRedeem[]; warnings: string[] }> {
  const applied: AppointmentPrepaidRedeem[] = [];
  const warnings: string[] = [];
  if (!redeems.length) return { applied, warnings };

  // Only the appointment_services snapshot table can carry the linkage; if it lacks
  // the prepaid column (older installs) we still consume + log a warning.
  const servicesTable = await tenantTable(slug, "appointment_services").catch(() => null);
  const hasLinkColumn = servicesTable
    ? await columnExists(servicesTable.name, "client_prepaid_service_id")
    : false;

  // Drop redeems for services not on this appointment, those a package already
  // covers, and dedupe so a service is covered by at most ONE prepaid (first wins).
  const onAppointment = new Set(serviceIds.filter((id) => id > 0));
  const seenService = new Set<number>();

  for (const redeem of redeems) {
    const clientPrepaidServiceId = Number(redeem.clientPrepaidServiceId ?? 0);
    const serviceId = Number(redeem.serviceId ?? 0);
    if (clientPrepaidServiceId <= 0 || serviceId <= 0) continue;
    if (!onAppointment.has(serviceId)) continue; // service not on the appointment
    if (coveredServiceIds?.has(serviceId)) continue; // already covered by a package
    if (seenService.has(serviceId)) continue; // already covered by another prepaid
    seenService.add(serviceId);

    try {
      // 1) Load the prepaid, tenant-scoped (tenantSelect scopes to the tenant).
      const prepaidRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "client_prepaid_services",
        columns: "id, client_id, service_id, service_name, status, expires_at, remaining_qty",
        where: "id = ?",
        params: [clientPrepaidServiceId],
        limit: 1,
      });
      const prepaid = prepaidRows[0];
      if (!prepaid) {
        warnings.push("Prepagato non trovato.");
        continue;
      }

      // 2) Ownership: the prepaid must belong to the appointment's client.
      if (Number(prepaid.client_id ?? 0) !== clientId) {
        warnings.push("Il prepagato selezionato non appartiene al cliente.");
        continue;
      }

      // 3) Coverage: a prepaid covers exactly its own service_id (no coverage table).
      if (Number(prepaid.service_id ?? 0) !== serviceId) {
        warnings.push("Il prepagato selezionato non copre il servizio.");
        continue;
      }

      // 4) Active + not expired + remaining > 0 (effective status, like the legacy
      //    availability rule status='active' AND remaining_qty>0 AND not expired).
      const remaining = Math.max(0, Number(prepaid.remaining_qty ?? 0));
      const expiresYmd = prepaid.expires_at ? String(prepaid.expires_at).slice(0, 10) : "";
      const effectiveStatus = clientPrepaidStatus(String(prepaid.status ?? "active"), remaining, expiresYmd);
      if (effectiveStatus !== "active") {
        warnings.push(`Prepagato ${String(prepaid.service_name ?? "")} non utilizzabile (${effectiveStatus}).`.trim());
        continue;
      }
      if (remaining <= 0) {
        warnings.push("Residuo prepagato esaurito.");
        continue;
      }

      // 5) Consume ONE unit via the authoritative primitive (re-reads remaining and
      //    THROWS on insufficient balance, so we never over-consume; flips status to
      //    'completed' at 0 and writes the usage ledger).
      await consumeDbPrepaid(clientPrepaidServiceId, 1, slug);

      // 6) Link the appointment_services row + zero its charge (keep list_price).
      if (hasLinkColumn && servicesTable) {
        await updateAppointmentServicePrepaidLink(slug, servicesTable, appointmentId, serviceId, clientPrepaidServiceId);
      } else {
        warnings.push("Unità prepagato consumata, ma il collegamento al servizio non è disponibile su questo archivio.");
      }

      applied.push({ clientPrepaidServiceId, serviceId });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Errore riscatto prepagato.");
    }
  }

  return { applied, warnings };
}

// Set the prepaid linkage on a single appointment_services row (keyed by the
// composite appointment_id + service_id — the table has no surrogate id) and zero
// its charge: price 0, list_price preserved as the catalog reference, and a
// 'Prepagato' discount_badge (faithful to the legacy zero-charge presentation).
async function updateAppointmentServicePrepaidLink(
  slug: string,
  table: TenantTable,
  appointmentId: number,
  serviceId: number,
  clientPrepaidServiceId: number,
): Promise<void> {
  const assignments: string[] = [
    "client_prepaid_service_id = ?",
    "price = 0",
  ];
  const params: unknown[] = [clientPrepaidServiceId];
  if (await columnExists(table.name, "discount_badge")) assignments.push("discount_badge = 'Prepagato'");
  const clauses = ["appointment_id = ?", "service_id = ?"];
  params.push(appointmentId, serviceId);
  if (table.mode === "shared" && (await columnExists(table.name, "tenant_id"))) {
    clauses.push("tenant_id = ?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${assignments.join(", ")} WHERE ${clauses.join(" AND ")}`,
    params,
  );
}

// One entry from the quick-booking `giftbox_redeem` JSON array (assets/js/app.js
// #qb_giftbox_redeem): cover a service with ONE ITEM from a client's giftbox. GiftBox
// is per-service + ITEM-based (like a package): a single giftbox item (identified by
// instance_id + giftbox_item_id, the giftbox_instance_items.giftbox_item_id value)
// covers one service, consuming one unit of that item. `serviceId` must be on the
// appointment. The redemption is recorded in giftbox_redemptions + giftbox_redemption_items.
export type AppointmentGiftboxRedeem = {
  instanceId: number;
  giftboxItemId: number; // = giftbox_instance_items.giftbox_item_id (NOT the row's surrogate id)
  serviceId: number;
};

// Apply the quick-booking GIFTBOX redeems for an appointment AS PART of the save. For
// each requested redeem this RE-VALIDATES server-side (never trusting the client): the
// giftbox instance exists, belongs to the appointment's client (recipient_client_id,
// else client_id), is 'issued' + not expired; the item exists ON that instance for the
// redeemed service (giftbox_instance_items WHERE instance_id + giftbox_item_id +
// service_id), and the item's residual (qty - already-redeemed via giftBoxItemRedeemedUnits)
// is > 0. On success it RECORDS the redemption — a giftbox_redemptions row (instance_id,
// redeemed_at, source_type='appointment', source_id=appointmentId) + a
// giftbox_redemption_items row (redemption_id, giftbox_item_id, qty 1), exactly the
// tables the legacy GiftBox::redeemInstanceItems writes — so giftBoxItemRedeemedUnits
// immediately reflects the consumption and the unit can never be double-redeemed. It
// then links the matching appointment_services row (giftbox_instance_id + giftbox_item_id)
// and zeroes its charge (price 0, list_price kept, 'GiftBox' badge). When the item is the
// instance's LAST residual unit the instance is flipped to status='redeemed' (parity with
// redeemInstanceItems). A redeem that fails validation is SKIPPED (collected as a warning)
// and never fails the whole booking (legacy best-effort parity).
//
// `coveredServiceIds` are the services already covered by a PACKAGE or PREPAID redeem in
// this same save — those are skipped so a service is covered at most once (dedupe). Like
// the package/prepaid apply we additionally dedupe so a service is giftbox-covered by at
// most one item (first wins). Faithful to api_appointments.php +
// GiftBox::redeemInstanceItems, adapted to the Next port's consume-on-save + link.
export async function applyAppointmentGiftboxRedeems({
  slug,
  appointmentId,
  clientId,
  serviceIds,
  redeems,
  coveredServiceIds,
}: {
  slug: string;
  appointmentId: number;
  clientId: number;
  serviceIds: number[]; // service_ids actually on this appointment (the redeem is filtered to these)
  redeems: AppointmentGiftboxRedeem[];
  coveredServiceIds?: Set<number>; // services already covered by a package/prepaid redeem (skip)
}): Promise<{ applied: AppointmentGiftboxRedeem[]; warnings: string[] }> {
  const applied: AppointmentGiftboxRedeem[] = [];
  const warnings: string[] = [];
  if (!redeems.length) return { applied, warnings };

  // The redemption recording tables must exist; without them we cannot consume a unit
  // safely (the residual maths reads them), so we skip with a warning (best-effort).
  const hasRedemptionTables =
    (await tableExists((await tenantTable(slug, "giftbox_redemptions").catch(() => ({ name: "" } as TenantTable))).name)) &&
    (await tableExists((await tenantTable(slug, "giftbox_redemption_items").catch(() => ({ name: "" } as TenantTable))).name));

  // Only the appointment_services snapshot table can carry the linkage; if it lacks the
  // giftbox columns (older installs) we still record + consume + log a warning.
  const servicesTable = await tenantTable(slug, "appointment_services").catch(() => null);
  const hasLinkColumns = servicesTable
    ? (await columnExists(servicesTable.name, "giftbox_instance_id")) &&
      (await columnExists(servicesTable.name, "giftbox_item_id"))
    : false;

  // Drop redeems for services not on this appointment, those a package/prepaid already
  // covers, and dedupe so a service is covered by at most ONE giftbox item (first wins).
  const onAppointment = new Set(serviceIds.filter((id) => id > 0));
  const seenService = new Set<number>();

  for (const redeem of redeems) {
    const instanceId = Number(redeem.instanceId ?? 0);
    const giftboxItemId = Number(redeem.giftboxItemId ?? 0);
    const serviceId = Number(redeem.serviceId ?? 0);
    if (instanceId <= 0 || giftboxItemId <= 0 || serviceId <= 0) continue;
    if (!onAppointment.has(serviceId)) continue; // service not on the appointment
    if (coveredServiceIds?.has(serviceId)) continue; // already covered by a package/prepaid
    if (seenService.has(serviceId)) continue; // already covered by another giftbox item
    seenService.add(serviceId);

    if (!hasRedemptionTables) {
      warnings.push("GiftBox: schema riscatti non disponibile su questo archivio.");
      continue;
    }

    try {
      // 1) Load the giftbox instance, tenant-scoped (tenantSelect scopes to the tenant).
      const instanceRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "giftbox_instances",
        columns: "id, client_id, recipient_client_id, status, issued_at, expires_at",
        where: "id = ?",
        params: [instanceId],
        limit: 1,
      });
      const instance = instanceRows[0];
      if (!instance) {
        warnings.push("GiftBox non trovata.");
        continue;
      }

      // 2) Ownership: the instance must belong to the appointment's client. The target
      //    is recipient_client_id when set, else client_id (same rule the residuals block
      //    + GiftBox::instanceBelongsToClient use).
      const recipientId = Number(instance.recipient_client_id ?? 0);
      const ownerId = Number(instance.client_id ?? 0);
      const belongs = recipientId > 0 ? recipientId === clientId : ownerId === clientId;
      if (!belongs) {
        warnings.push("La GiftBox selezionata non appartiene al cliente.");
        continue;
      }

      // 3) Status 'issued' + not yet valid? + not expired (parity with redeemInstanceItems).
      const status = String(instance.status ?? "").toLowerCase();
      if (status !== "issued" && status !== "active") {
        warnings.push("GiftBox non riscattabile.");
        continue;
      }
      const issuedYmd = instance.issued_at ? String(instance.issued_at).slice(0, 10) : "";
      if (issuedYmd && issuedYmd > todayIso()) {
        warnings.push("GiftBox non ancora valida.");
        continue;
      }
      const expiresYmd = instance.expires_at ? String(instance.expires_at).slice(0, 10) : "";
      if (expiresYmd && expiresYmd < todayIso()) {
        warnings.push("GiftBox scaduta.");
        continue;
      }

      // 4) Coverage: the item must exist ON this instance for the redeemed service, keyed
      //    by the giftbox_instance_items.giftbox_item_id column (the threaded identifier,
      //    NOT the row's surrogate id — faithful to qb_giftbox_item_remaining).
      const itemRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "giftbox_instance_items",
        columns: "giftbox_item_id, service_id, qty",
        where: "instance_id = ? AND giftbox_item_id = ?",
        params: [instanceId, giftboxItemId],
        limit: 1,
      });
      const item = itemRows[0];
      if (!item) {
        warnings.push("Elemento GiftBox non valido.");
        continue;
      }
      if (Number(item.service_id ?? 0) !== serviceId) {
        warnings.push("La GiftBox selezionata non copre il servizio.");
        continue;
      }

      // 5) Residual: item qty - already-redeemed (per item) must be > 0. Reading the
      //    redemption tables means a unit recorded earlier in THIS save (an earlier
      //    redeem of the same item) is already counted, so we never over-redeem.
      const totalQty = Math.max(0, Number(item.qty ?? 0));
      const redeemedQty = await giftBoxItemRedeemedUnits(slug, instanceId, giftboxItemId);
      if (totalQty - redeemedQty <= 0) {
        warnings.push("Unità GiftBox esaurite per l'elemento selezionato.");
        continue;
      }

      // 6) RECORD the redemption: a header row + a single redemption-item row (qty 1).
      //    This is the consume — it makes giftBoxItemRedeemedUnits reflect the unit.
      const redemptionId = await tenantInsert(await tenantTable(slug, "giftbox_redemptions"), {
        instance_id: instanceId,
        redeemed_at: new Date(),
        source_type: "appointment",
        source_id: appointmentId,
      });
      if (redemptionId <= 0) {
        warnings.push("GiftBox: impossibile registrare il riscatto.");
        continue;
      }
      await tenantInsert(await tenantTable(slug, "giftbox_redemption_items"), {
        redemption_id: redemptionId,
        giftbox_item_id: giftboxItemId,
        qty: 1,
      });

      // 7) If this item was the instance's LAST residual unit across ALL its items,
      //    flip the instance to 'redeemed' (parity with redeemInstanceItems' allDone).
      try {
        const allItems = await tenantSelect<RowDataPacket>({
          slug,
          table: "giftbox_instance_items",
          columns: "giftbox_item_id, qty",
          where: "instance_id = ?",
          params: [instanceId],
        });
        let anyRemaining = false;
        for (const it of allItems) {
          const itId = Number(it.giftbox_item_id ?? 0);
          if (itId <= 0) continue;
          const used = await giftBoxItemRedeemedUnits(slug, instanceId, itId);
          if (Math.max(0, Number(it.qty ?? 0)) - used > 0) {
            anyRemaining = true;
            break;
          }
        }
        if (!anyRemaining) {
          await tenantUpdate({
            slug,
            table: "giftbox_instances",
            id: instanceId,
            values: { status: "redeemed", redeemed_at: new Date(), redeemed_source_type: "appointment", redeemed_source_id: appointmentId },
          });
        }
      } catch {
        // best-effort: a status-flip failure must not fail the booking (unit is recorded).
      }

      // 8) Link the appointment_services row + zero its charge (keep list_price).
      if (hasLinkColumns && servicesTable) {
        await updateAppointmentServiceGiftboxLink(slug, servicesTable, appointmentId, serviceId, {
          instanceId,
          giftboxItemId,
        });
      } else {
        warnings.push("Unità GiftBox consumata, ma il collegamento al servizio non è disponibile su questo archivio.");
      }

      applied.push({ instanceId, giftboxItemId, serviceId });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Errore riscatto GiftBox.");
    }
  }

  return { applied, warnings };
}

// Set the giftbox linkage on a single appointment_services row (keyed by the composite
// appointment_id + service_id — the table has no surrogate id) and zero its charge:
// price 0, list_price preserved as the catalog reference, and a 'GiftBox' discount_badge
// (faithful to the legacy zero-charge presentation, mirroring the package/prepaid links).
async function updateAppointmentServiceGiftboxLink(
  slug: string,
  table: TenantTable,
  appointmentId: number,
  serviceId: number,
  link: { instanceId: number; giftboxItemId: number },
): Promise<void> {
  const assignments: string[] = [
    "giftbox_instance_id = ?",
    "giftbox_item_id = ?",
    "price = 0",
  ];
  const params: unknown[] = [link.instanceId, link.giftboxItemId];
  if (await columnExists(table.name, "discount_badge")) assignments.push("discount_badge = 'GiftBox'");
  const clauses = ["appointment_id = ?", "service_id = ?"];
  params.push(appointmentId, serviceId);
  if (table.mode === "shared" && (await columnExists(table.name, "tenant_id"))) {
    clauses.push("tenant_id = ?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${assignments.join(", ")} WHERE ${clauses.join(" AND ")}`,
    params,
  );
}

// One entry from the quick-booking `gift_redeem` JSON array (assets/js/app.js
// #qb_gift_redeem): cover a service with ONE REWARD from a client's GIFT (omaggio). A gift
// INSTANCE holds REWARD ITEMS (gifts.reward_items_json); a SERVICE reward (type='service')
// is a free service. A redeem applies ONE reward — identified by instance_id +
// reward_item_index (the reward's ARRAY INDEX in reward_items_json) — to a booked service
// (zero-charge), consuming one unit of that reward. `serviceId` must be on the appointment
// and must match the reward's service. The redemption is recorded in appointment_gift_items
// (redeemed_at set), keyed by the legacy composite (instance + reward_item_index + service).
export type AppointmentGiftRedeem = {
  instanceId: number;
  rewardItemIndex: number; // = array index in gifts.reward_items_json
  serviceId: number;
};

// Apply the quick-booking GIFT (omaggio) redeems for an appointment AS PART of the save.
// For each requested redeem this RE-VALIDATES server-side (never trusting the client): the
// gift instance exists, belongs to the appointment's client (gift_instances.client_id), is
// state='disponibile' + active + not expired; the reward at `reward_item_index` (from the
// instance's gift.reward_items_json) is a SERVICE reward for exactly `serviceId`; and that
// reward's residual (reward qty MINUS already-redeemed via giftRewardRedeemedQty) is > 0. On
// success it RECORDS the redemption — an appointment_gift_items row (appointment_id,
// instance_id, gift_id, reward_item_index, service_id, qty 1, redeemed_at=NOW) — the same
// table the legacy Gifts redemption writes — so giftRewardRedeemedQty immediately reflects
// the consumption and the reward can never be double-redeemed within or across saves. It then
// links the matching appointment_services row (gift_instance_id + reward_item_index,
// columnExists-guarded) and zeroes its charge (price 0, list_price kept, 'Omaggio' badge).
// When the reward is the instance's LAST residual SERVICE reward the instance is flipped to
// state='riscattato' (parity with the legacy auto-redeem). A redeem that fails validation is
// SKIPPED (collected as a warning) and never fails the whole booking (legacy best-effort
// parity).
//
// `coveredServiceIds` are the services already covered by a PACKAGE, PREPAID or GIFTBOX
// redeem in this same save — those are skipped so a service is covered at most once (dedupe).
// Like the other applies we additionally dedupe so a service is gift-covered by at most one
// reward (first wins). Faithful to api_appointments.php + Gifts (reward-item redemption),
// adapted to the Next port's consume-on-save + columnExists-guarded link.
export async function applyAppointmentGiftRedeems({
  slug,
  appointmentId,
  clientId,
  serviceIds,
  redeems,
  coveredServiceIds,
}: {
  slug: string;
  appointmentId: number;
  clientId: number;
  serviceIds: number[]; // service_ids actually on this appointment (the redeem is filtered to these)
  redeems: AppointmentGiftRedeem[];
  coveredServiceIds?: Set<number>; // services already covered by a package/prepaid/giftbox redeem (skip)
}): Promise<{ applied: AppointmentGiftRedeem[]; warnings: string[] }> {
  const applied: AppointmentGiftRedeem[] = [];
  const warnings: string[] = [];
  if (!redeems.length) return { applied, warnings };

  // The tracking table must exist; without it we cannot consume a reward safely (the
  // residual maths reads it), so we skip with a warning (best-effort).
  const giftItemsTable = await tenantTable(slug, "appointment_gift_items").catch(() => null);
  const hasTrackingTable = giftItemsTable ? await tableExists(giftItemsTable.name) : false;

  // Only the appointment_services snapshot table can carry the linkage; if it lacks the
  // gift columns (older installs) we still record + consume + log a warning.
  const servicesTable = await tenantTable(slug, "appointment_services").catch(() => null);
  const hasLinkColumns = servicesTable
    ? (await columnExists(servicesTable.name, "gift_instance_id")) &&
      (await columnExists(servicesTable.name, "reward_item_index"))
    : false;

  // Drop redeems for services not on this appointment, those a package/prepaid/giftbox
  // already covers, and dedupe so a service is covered by at most ONE gift reward (first wins).
  const onAppointment = new Set(serviceIds.filter((id) => id > 0));
  const seenService = new Set<number>();

  for (const redeem of redeems) {
    const instanceId = Number(redeem.instanceId ?? 0);
    const rewardItemIndex = Number(redeem.rewardItemIndex ?? 0);
    const serviceId = Number(redeem.serviceId ?? 0);
    if (instanceId <= 0 || serviceId <= 0 || rewardItemIndex < 0) continue;
    if (!onAppointment.has(serviceId)) continue; // service not on the appointment
    if (coveredServiceIds?.has(serviceId)) continue; // already covered by a package/prepaid/giftbox
    if (seenService.has(serviceId)) continue; // already covered by another gift reward
    seenService.add(serviceId);

    if (!hasTrackingTable) {
      warnings.push("Omaggio: schema riscatti non disponibile su questo archivio.");
      continue;
    }

    try {
      // 1) Load the gift instance, tenant-scoped (tenantSelect scopes to the tenant).
      const instanceRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "gift_instances",
        columns: "id, gift_id, client_id, state, is_active, expires_at",
        where: "id = ?",
        params: [instanceId],
        limit: 1,
      });
      const instance = instanceRows[0];
      if (!instance) {
        warnings.push("Omaggio non trovato.");
        continue;
      }

      // 2) Ownership: the instance must belong to the appointment's client.
      if (Number(instance.client_id ?? 0) !== clientId) {
        warnings.push("L'omaggio selezionato non appartiene al cliente.");
        continue;
      }

      // 3) Availability: state='disponibile' + (is_active OR state in disponibile/riscattato)
      //    + not expired (by calendar day) — parity with Gifts::clientAvailableInstances.
      const state = String(instance.state ?? "").trim().toLowerCase();
      const isActive = Number(instance.is_active ?? 0);
      if (state !== "disponibile") {
        warnings.push("Omaggio non riscattabile.");
        continue;
      }
      if (!(isActive === 1 || state === "disponibile" || state === "riscattato")) {
        warnings.push("Omaggio non attivo.");
        continue;
      }
      const expiresYmd = instance.expires_at ? String(instance.expires_at).slice(0, 10) : "";
      if (expiresYmd && expiresYmd < todayIso()) {
        warnings.push("Omaggio scaduto.");
        continue;
      }

      // 4) Coverage: the reward at reward_item_index (from the instance's gift) must be a
      //    SERVICE reward for exactly this service. Read reward_items_json off the gift def.
      const giftId = Number(instance.gift_id ?? 0);
      const giftRows = giftId > 0
        ? await tenantSelect<RowDataPacket>({ slug, table: "gifts", columns: "reward_items_json", where: "id = ?", params: [giftId], limit: 1 })
        : [];
      const rewardItems = parseGiftRewardItems(giftRows[0]?.reward_items_json);
      const reward = rewardItems[rewardItemIndex];
      if (!reward || reward.type !== "service" || reward.serviceId <= 0) {
        warnings.push("Omaggio non valido per il servizio.");
        continue;
      }
      if (reward.serviceId !== serviceId) {
        warnings.push("L'omaggio selezionato non copre il servizio.");
        continue;
      }

      // 5) Residual: reward qty - already-redeemed (by index + service) must be > 0. Reading
      //    appointment_gift_items means a unit recorded earlier in THIS save (an earlier
      //    redeem of the same reward) is already counted, so we never over-redeem.
      const redeemedQty = await giftRewardRedeemedQty(slug, instanceId, rewardItemIndex, serviceId);
      if (reward.qty - redeemedQty <= 0) {
        warnings.push("Omaggio esaurito per la ricompensa selezionata.");
        continue;
      }

      // 6) RECORD the redemption: an appointment_gift_items row with redeemed_at set (qty 1).
      //    This is the consume — it makes giftRewardRedeemedQty reflect the unit immediately.
      const insertId = await tenantInsert(await tenantTable(slug, "appointment_gift_items"), {
        appointment_id: appointmentId,
        instance_id: instanceId,
        gift_id: giftId,
        reward_item_index: rewardItemIndex,
        service_id: serviceId,
        qty: 1,
        redeemed_at: new Date(),
      });
      if (insertId <= 0) {
        warnings.push("Omaggio: impossibile registrare il riscatto.");
        continue;
      }

      // 7) If this reward was the instance's LAST residual SERVICE reward, flip the instance
      //    to state='riscattato' (parity with the legacy auto-close on service rewards).
      try {
        let anyRemaining = false;
        for (let index = 0; index < rewardItems.length; index += 1) {
          const it = rewardItems[index];
          if (it.type !== "service" || it.serviceId <= 0) continue;
          const used = await giftRewardRedeemedQty(slug, instanceId, index, it.serviceId);
          if (it.qty - used > 0) {
            anyRemaining = true;
            break;
          }
        }
        if (!anyRemaining) {
          await tenantUpdate({
            slug,
            table: "gift_instances",
            id: instanceId,
            values: { state: "riscattato", redeemed_at: new Date(), redeemed_source_type: "appointment", redeemed_source_id: appointmentId },
          });
        }
      } catch {
        // best-effort: a state-flip failure must not fail the booking (unit is recorded).
      }

      // 8) Link the appointment_services row + zero its charge (keep list_price).
      if (hasLinkColumns && servicesTable) {
        await updateAppointmentServiceGiftLink(slug, servicesTable, appointmentId, serviceId, {
          instanceId,
          rewardItemIndex,
        });
      } else {
        warnings.push("Omaggio consumato, ma il collegamento al servizio non è disponibile su questo archivio.");
      }

      applied.push({ instanceId, rewardItemIndex, serviceId });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Errore riscatto Omaggio.");
    }
  }

  return { applied, warnings };
}

// Set the gift linkage on a single appointment_services row (keyed by the composite
// appointment_id + service_id — the table has no surrogate id) and zero its charge:
// price 0, list_price preserved as the catalog reference, and an 'Omaggio' discount_badge
// (faithful to the legacy zero-charge presentation, mirroring the package/prepaid/giftbox links).
async function updateAppointmentServiceGiftLink(
  slug: string,
  table: TenantTable,
  appointmentId: number,
  serviceId: number,
  link: { instanceId: number; rewardItemIndex: number },
): Promise<void> {
  const assignments: string[] = [
    "gift_instance_id = ?",
    "reward_item_index = ?",
    "price = 0",
  ];
  const params: unknown[] = [link.instanceId, link.rewardItemIndex];
  if (await columnExists(table.name, "discount_badge")) assignments.push("discount_badge = 'Omaggio'");
  const clauses = ["appointment_id = ?", "service_id = ?"];
  params.push(appointmentId, serviceId);
  if (table.mode === "shared" && (await columnExists(table.name, "tenant_id"))) {
    clauses.push("tenant_id = ?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${assignments.join(", ")} WHERE ${clauses.join(" AND ")}`,
    params,
  );
}

// One entry from the quick-booking `giftcard_redeem` JSON array (assets/js/app.js
// #qb_giftcard_redeem): apply a client's GiftCard BALANCE (a monetary amount) toward
// the WHOLE appointment. Unlike package/prepaid (per-service units), this is
// APPOINTMENT-LEVEL + MONETARY: one giftcard, one amount. `amount` is the requested
// amount to apply; it is re-clamped server-side to min(amount, balance, payableTotal).
export type AppointmentGiftcardRedeem = {
  giftcardId: number;
  amount: number;
};

// Apply the quick-booking GIFTCARD redeem for an appointment AS PART of the save.
// GiftCard is APPOINTMENT-LEVEL + MONETARY (not per-service like package/prepaid):
// ONE giftcard per appointment, an AMOUNT applied toward the appointment's payable
// total. For the FIRST requested redeem that passes validation this RE-VALIDATES
// server-side (never trusting the client): the giftcard exists, belongs to the
// appointment's client (recipient_client_id, else client_id), is active + not expired
// + has balance > 0. It then computes the appointment's PAYABLE TOTAL server-side as
// SUM(appointment_services.price) over the rows just inserted (a service zero-charged
// by a package/prepaid redeem already has price 0, so it never inflates the cap),
// CLAMPS the requested amount to min(requestedAmount, balance, payableTotal), and —
// when the clamped amount is > 0 — decrements the giftcard via redeemDbGiftCard
// (which re-reads the balance and THROWS on over-redeem, flips status to 'redeemed'
// at 0, and writes a giftcard_transactions movement) and links the appointment
// (appointments.giftcard_id + giftcard_used = clamped amount, columnExists-guarded).
// A redeem that fails validation / clamps to 0 is SKIPPED (collected as a warning)
// and never fails the whole booking (legacy best-effort parity).
//
// Faithful to api_appointments.php qb_apply_giftcard_redeem_to_appointment (+
// qb_giftcard_appointment_schema_available), adapted to the Next port's
// consume-on-save + columnExists-guarded appointment link.
export async function applyAppointmentGiftcardRedeem({
  slug,
  appointmentId,
  clientId,
  redeems,
}: {
  slug: string;
  appointmentId: number;
  clientId: number;
  redeems: AppointmentGiftcardRedeem[];
}): Promise<{ applied: AppointmentGiftcardRedeem | null; warnings: string[] }> {
  const warnings: string[] = [];
  if (!redeems.length) return { applied: null, warnings };

  // Only the appointments table can carry the linkage; if it lacks the giftcard
  // columns (older installs) we still decrement the balance + log a warning. This
  // mirrors qb_giftcard_appointment_schema_available.
  const appointmentsTable = await tenantTable(slug, "appointments").catch(() => null);
  const hasLinkColumns = appointmentsTable
    ? (await columnExists(appointmentsTable.name, "giftcard_id")) &&
      (await columnExists(appointmentsTable.name, "giftcard_used"))
    : false;

  // The appointment's PAYABLE TOTAL: SUM(appointment_services.price) AFTER any
  // package/prepaid zeroing (those rows already have price 0). Computed once, used as
  // the upper cap so we never redeem more than the appointment can absorb. If the
  // snapshot table is absent we fall back to 0 (nothing payable -> nothing to apply).
  let payableTotal = 0;
  try {
    const serviceRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointment_services",
      columns: "price",
      where: "appointment_id = ?",
      params: [appointmentId],
    });
    payableTotal = roundMoney(
      serviceRows.reduce((sum, row) => sum + Math.max(0, parseMoney(row.price, 0)), 0),
    );
  } catch {
    payableTotal = 0;
  }

  // ONE giftcard per appointment: take the FIRST entry that validates + clamps > 0.
  for (const redeem of redeems) {
    const giftcardId = Number(redeem.giftcardId ?? 0);
    const requestedAmount = roundMoney(Math.max(0, Number(redeem.amount ?? 0)));
    if (giftcardId <= 0) continue;

    try {
      // 1) Load the giftcard, tenant-scoped (tenantSelect scopes to the tenant).
      const giftcardTable = await tenantTable(slug, "giftcards");
      const hasRecipient = await columnExists(giftcardTable.name, "recipient_client_id");
      const giftcardRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "giftcards",
        columns: hasRecipient
          ? "id, client_id, recipient_client_id, code, status, expires_at, balance"
          : "id, client_id, code, status, expires_at, balance",
        where: "id = ?",
        params: [giftcardId],
        limit: 1,
      });
      const giftcard = giftcardRows[0];
      if (!giftcard) {
        warnings.push("GiftCard non trovata.");
        continue;
      }

      // 2) Ownership: the giftcard must belong to the appointment's client. The
      //    recipient_client_id (when present) is the target client; older installs
      //    fall back to client_id (mirrors the residuals availability rule).
      const ownerId = hasRecipient
        ? Number(giftcard.recipient_client_id ?? 0)
        : Number(giftcard.client_id ?? 0);
      if (ownerId !== clientId) {
        warnings.push("La GiftCard selezionata non appartiene al cliente.");
        continue;
      }

      // 3) Active + not expired + balance > 0 (effective status, like giftCardStatus).
      const balance = roundMoney(Math.max(0, parseMoney(giftcard.balance, 0)));
      const expiresYmd = giftcard.expires_at ? String(giftcard.expires_at).slice(0, 10) : "";
      const effectiveStatus = giftCardStatus(String(giftcard.status ?? "active"), expiresYmd);
      if (effectiveStatus !== "active") {
        warnings.push(`GiftCard ${String(giftcard.code ?? "")} non utilizzabile (${effectiveStatus}).`.trim());
        continue;
      }
      if (balance <= 0) {
        warnings.push("Saldo GiftCard esaurito.");
        continue;
      }

      // 4) Clamp the requested amount to [0, min(balance, payableTotal)]. We never
      //    redeem more than the giftcard balance NOR more than the appointment's
      //    payable total (financial correctness). A 0 clamp -> nothing to apply.
      const clamped = roundMoney(Math.min(requestedAmount, balance, payableTotal));
      if (clamped <= 0) {
        if (payableTotal <= 0) warnings.push("Nessun importo da coprire con la GiftCard.");
        else warnings.push("Importo GiftCard non valido.");
        continue;
      }

      // 5) Decrement the giftcard via the authoritative primitive (re-reads the
      //    balance and THROWS on over-redeem, so we never over-decrement; flips status
      //    to 'redeemed' at 0 and writes the giftcard_transactions movement).
      await redeemDbGiftCard(giftcardId, clamped, slug);

      // 6) Link the appointment: giftcard_id + giftcard_used = clamped amount.
      if (hasLinkColumns && appointmentsTable) {
        await tenantUpdate({
          slug,
          table: "appointments",
          id: appointmentId,
          values: { giftcard_id: giftcardId, giftcard_used: clamped },
        });
      } else {
        warnings.push("Saldo GiftCard scalato, ma il collegamento all'appuntamento non è disponibile su questo archivio.");
      }

      return { applied: { giftcardId, amount: clamped }, warnings };
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Errore riscatto GiftCard.");
    }
  }

  return { applied: null, warnings };
}

export async function listDbPrepaids(slug: string): Promise<ClientPrepaid[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "client_prepaid_services",
    orderBy: "created_at DESC, id DESC",
  });
  return Promise.all(rows.map((row) => mapClientPrepaid(slug, row)));
}

export async function issueDbPrepaid(
  input: { clientId?: number; clientName?: string; serviceId?: number; quantity?: number; expiresAt?: string; sourceSaleId?: number },
  slug: string,
): Promise<ClientPrepaid> {
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const service = input.serviceId && input.serviceId > 0
    ? await getSingleService(slug, input.serviceId)
    : (await listDbServices({ slug, includeInactive: false }))[0];
  if (!service) throw new Error("Servizio prepagato non trovato.");
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const unitPrice = parseMoney(service.price, 0);
  const id = await tenantInsert(await tenantTable(slug, "client_prepaid_services"), {
    client_id: client.id,
    sale_id: input.sourceSaleId && input.sourceSaleId > 0 ? input.sourceSaleId : null,
    service_id: service.id,
    service_name: service.name,
    purchased_qty: quantity,
    remaining_qty: quantity,
    unit_price: unitPrice,
    total_paid: roundMoney(unitPrice * quantity),
    status: "active",
    purchase_date: new Date(),
    expires_at: input.expiresAt ?? addDaysDate(120),
  });
  return getSinglePrepaid(slug, id);
}

export async function consumeDbPrepaid(id: number, quantity: number, slug: string): Promise<ClientPrepaid> {
  const current = await getSinglePrepaid(slug, id);
  if (current.status !== "active") throw new Error("Prepagato non utilizzabile.");
  const usedQuantity = Math.max(1, Math.round(quantity));
  if (current.remainingQuantity < usedQuantity) throw new Error("Residuo prepagato insufficiente.");
  const remaining = current.remainingQuantity - usedQuantity;
  await tenantUpdate({
    slug,
    table: "client_prepaid_services",
    id,
    values: { remaining_qty: remaining, status: remaining <= 0 ? "completed" : "active" },
  });
  await tenantInsert(await tenantTable(slug, "client_prepaid_service_usages"), {
    client_prepaid_service_id: id,
    qty: usedQuantity,
    used_at: new Date(),
    note: "Esecuzione manuale",
  }).catch(() => 0);
  return getSinglePrepaid(slug, id);
}

export async function listDbPreorders(slug: string): Promise<Preorder[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_items",
    where: "item_type = 'product' AND (item_status = 'ordered' OR preorder_expires_at IS NOT NULL)",
    orderBy: "id DESC",
  });
  return Promise.all(rows.map((row) => mapPreorder(slug, row)));
}

export async function createDbPreorder(
  input: { clientId?: number; clientName?: string; productId?: number; quantity?: number; deposit?: number; dueDate?: string },
  slug: string,
): Promise<Preorder> {
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const product = input.productId && input.productId > 0
    ? await getSingleProduct(slug, input.productId)
    : (await listDbProducts({ slug }))[0];
  if (!product) throw new Error("Prodotto preordine non trovato.");
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const deposit = roundMoney(Math.max(0, Number(input.deposit ?? 0)));
  const saleId = await tenantInsert(await tenantTable(slug, "sales"), {
    client_id: client.id > 0 ? client.id : null,
    sale_date: new Date(),
    subtotal: deposit,
    discount: 0,
    total: deposit,
    notes: `Preordine ${product.name}`,
    status: "done",
  });
  const itemId = await tenantInsert(await tenantTable(slug, "sale_items"), {
    sale_id: saleId,
    item_type: "product",
    item_id: product.id,
    item_name: product.name,
    qty: quantity,
    unit_price: parseMoney(product.price, 0),
    line_total: roundMoney(parseMoney(product.price, 0) * quantity),
    item_status: "ordered",
    preorder_expires_at: input.dueDate ?? addDaysDate(14),
  });
  return getSinglePreorder(slug, itemId);
}

export async function collectDbPreorder(id: number, slug: string): Promise<Preorder> {
  const preorder = await getSinglePreorder(slug, id);
  if (preorder.status !== "open") throw new Error("Preordine non ritirabile.");
  const product = await getSingleProduct(slug, preorder.productId);
  if (product.stock < preorder.quantity) throw new Error("Giacenza insufficiente per ritiro preordine.");
  await decrementProductStock(slug, product.id, preorder.quantity);
  await tenantUpdate({ slug, table: "sale_items", id, values: { item_status: "collected" } });
  return getSinglePreorder(slug, id);
}

export async function listDbCoupons(slug: string): Promise<CouponRule[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "coupons",
    where: "deleted_at IS NULL",
    orderBy: "code ASC",
  });
  return Promise.all(rows.map((row) => mapCoupon(slug, row)));
}

export async function createDbCoupon(input: Partial<CouponRule>, slug: string): Promise<CouponRule> {
  const code = normalizeCouponCode(String(input.code ?? ""));
  if (!code) throw new Error("Codice coupon mancante.");
  const existing = await tenantSelect<RowDataPacket>({ slug, table: "coupons", columns: "id", where: "code = ? AND deleted_at IS NULL", params: [code], limit: 1 });
  if (existing[0]) throw new Error("Coupon gia esistente.");
  const id = await tenantInsert(await tenantTable(slug, "coupons"), {
    code,
    description: code,
    discount_type: input.type === "fixed" ? "fixed" : "percent",
    discount_value: roundMoney(Math.max(0, Number(input.value ?? 0))),
    min_subtotal: roundMoney(Math.max(0, Number(input.minSubtotal ?? 0))),
    valid_from: input.startsAt ?? todayIso(),
    valid_to: input.endsAt ?? addDaysDate(30),
    is_active: input.active === false ? 0 : 1,
    usage_limit: Math.max(0, Math.round(Number(input.usageLimit ?? 0))),
    apply_scope: "all",
  });
  return getSingleCoupon(slug, id);
}

export async function previewDbCoupon(code: string, subtotal: number, slug: string): Promise<{ valid: boolean; discount: number; reason: string; coupon?: CouponRule }> {
  const coupon = await getCouponByCode(slug, code);
  if (!coupon) return { valid: false, discount: 0, reason: "Coupon non trovato." };
  if (!coupon.active || !activeWindow(coupon.startsAt, coupon.endsAt)) return { valid: false, discount: 0, reason: "Coupon non attivo.", coupon };
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return { valid: false, discount: 0, reason: "Coupon esaurito.", coupon };
  if (subtotal < coupon.minSubtotal) return { valid: false, discount: 0, reason: "Minimo carrello non raggiunto.", coupon };
  return { valid: true, discount: discountValue(coupon.type, coupon.value, subtotal), reason: "Coupon valido.", coupon };
}

export async function redeemDbCoupon(code: string, subtotal: number, slug: string): Promise<{ coupon: CouponRule; discount: number }> {
  const preview = await previewDbCoupon(code, subtotal, slug);
  if (!preview.valid || !preview.coupon) throw new Error(preview.reason);
  return { coupon: preview.coupon, discount: preview.discount };
}

export async function listDbPromotions(slug: string): Promise<PromotionRule[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "promotions",
    orderBy: "priority DESC, title ASC",
  });
  return rows.map(mapPromotion);
}

export async function toggleDbPromotion(id: number, active: boolean, slug: string): Promise<PromotionRule> {
  await tenantUpdate({ slug, table: "promotions", id, values: { is_active: active ? 1 : 0 } });
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "promotions", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Promozione non trovata.");
  return mapPromotion(rows[0]);
}

export async function previewDbPromotion(id: number, subtotal: number, slug: string): Promise<{ valid: boolean; discount: number; reason: string; promotion?: PromotionRule }> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "promotions", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) return { valid: false, discount: 0, reason: "Promozione non trovata." };
  const promotion = mapPromotion(rows[0]);
  if (!promotion.active || !activeWindow(promotion.startsAt, promotion.endsAt)) return { valid: false, discount: 0, reason: "Promozione non attiva.", promotion };
  return { valid: true, discount: discountValue(promotion.discountType, promotion.discountValue, subtotal), reason: "Promozione valida.", promotion };
}

export async function listDbGiftBoxes(slug: string): Promise<GiftBoxInstance[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "giftbox_instances",
    orderBy: "created_at DESC, id DESC",
  });
  return Promise.all(rows.map((row) => mapGiftBox(slug, row)));
}

export async function issueDbGiftBox(
  input: { clientId?: number; recipientName?: string; serviceId?: number; sessions?: number; expiresAt?: string; sourceSaleId?: number },
  slug: string,
): Promise<GiftBoxInstance> {
  const giftboxRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "giftboxes",
    where: "COALESCE(active, 1) = 1 AND deleted_at IS NULL",
    orderBy: "sort_order ASC, id ASC",
    limit: 1,
  });
  const service = input.serviceId && input.serviceId > 0 ? await getSingleService(slug, input.serviceId) : (await listDbServices({ slug }))[0];
  if (!service) throw new Error("Servizio GiftBox non trovato.");
  const giftboxId = Number(giftboxRows[0]?.id ?? 0);
  if (giftboxId <= 0) throw new Error("Catalogo GiftBox non trovato.");
  const id = await tenantInsert(await tenantTable(slug, "giftbox_instances"), {
    voucher_public_token: randomHex(64),
    giftbox_id: giftboxId,
    code: `GB${Date.now().toString(36).toUpperCase().slice(-8)}`,
    client_id: input.clientId && input.clientId > 0 ? input.clientId : null,
    recipient_name: normalizeName(input.recipientName, "Destinatario"),
    status: "issued",
    issued_at: new Date(),
    expires_at: input.expiresAt ?? addDaysDate(180),
    note: input.sourceSaleId ? `Vendita #${input.sourceSaleId}` : null,
  });
  await tenantInsert(await tenantTable(slug, "giftbox_instance_items"), {
    instance_id: id,
    giftbox_item_id: 0,
    item_type: "service",
    service_id: service.id,
    qty: Math.max(1, Math.round(input.sessions ?? 1)),
    custom_label: service.name,
  }).catch(() => 0);
  return getSingleGiftBox(slug, id);
}

export async function redeemDbGiftBox(id: number, quantity: number, slug: string): Promise<GiftBoxInstance> {
  const giftBox = await getSingleGiftBox(slug, id);
  if (giftBox.status !== "active") throw new Error("GiftBox non utilizzabile.");
  const qty = Math.max(1, Math.round(quantity));
  if (giftBox.remainingItems < qty) throw new Error("Residuo GiftBox insufficiente.");
  for (let index = 0; index < qty; index += 1) {
    await tenantInsert(await tenantTable(slug, "giftbox_redemptions"), {
      instance_id: id,
      redeemed_at: new Date(),
      source_type: "manual",
      note: "Riscatto manuale GiftBox",
    }).catch(() => 0);
  }
  if (giftBox.remainingItems - qty <= 0) {
    await tenantUpdate({ slug, table: "giftbox_instances", id, values: { status: "redeemed", redeemed_at: new Date() } });
  }
  return getSingleGiftBox(slug, id);
}

export async function listDbGifts(slug: string): Promise<GiftReward[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "gift_instances",
    orderBy: "created_at DESC, id DESC",
  });
  return Promise.all(rows.map((row) => mapGiftReward(slug, row)));
}

export async function issueDbGift(
  input: { clientId?: number; clientName?: string; title?: string; rewardType?: GiftReward["rewardType"]; value?: number; expiresAt?: string },
  slug: string,
): Promise<GiftReward> {
  const client = await resolveSaleClientForDb(slug, input.clientId ?? 0, input.clientName);
  const giftId = await ensureDbGiftTemplate(slug, input);
  const id = await tenantInsert(await tenantTable(slug, "gift_instances"), {
    voucher_public_token: randomHex(64),
    gift_id: giftId,
    client_id: client.id,
    state: "disponibile",
    is_active: 1,
    unlocked_at: new Date(),
    expires_at: input.expiresAt ?? addDaysDate(60),
    progress_json: JSON.stringify({ source: "next", value: input.value ?? 0 }),
  });
  return getSingleGift(slug, id);
}

export async function redeemDbGift(id: number, slug: string): Promise<GiftReward> {
  const gift = await getSingleGift(slug, id);
  if (gift.status !== "available") throw new Error("Omaggi non riscattabile.");
  await tenantUpdate({
    slug,
    table: "gift_instances",
    id,
    values: { state: "riscattato", is_active: 0, redeemed_at: new Date(), redeemed_source_type: "manual" },
  });
  await tenantInsert(await tenantTable(slug, "gift_transactions"), {
    instance_id: id,
    type: "redeem",
    qty: 1,
    note: "Riscatto manuale omaggio",
    created_at: new Date(),
  }).catch(() => 0);
  return getSingleGift(slug, id);
}

export async function listDbInstallmentPlans(slug: string): Promise<InstallmentPlan[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_installment_plans",
    orderBy: "created_at DESC, id DESC",
  });
  return Promise.all(rows.map((row) => mapInstallmentPlan(slug, row)));
}

export async function createDbInstallmentPlan(
  input: { saleId?: number; clientId?: number; clientName?: string; total?: number; count?: number },
  slug: string,
): Promise<InstallmentPlan> {
  const sale = input.saleId && input.saleId > 0 ? await getSaleRow(slug, input.saleId) : null;
  const client = await resolveSaleClientForDb(slug, input.clientId ?? Number(sale?.client_id ?? 0), input.clientName);
  const total = roundMoney(Math.max(1, Number(input.total ?? sale?.total ?? 0)));
  const count = Math.max(1, Math.round(Number(input.count ?? 3)));
  const amount = roundMoney(total / count);
  const planId = await tenantInsert(await tenantTable(slug, "sale_installment_plans"), {
    sale_id: input.saleId ?? Number(sale?.id ?? 0) ?? 0,
    client_id: client.id > 0 ? client.id : null,
    payment_type: "card",
    status: "active",
    sale_total: total,
    down_payment_amount: 0,
    financed_amount: total,
    installments_count: count,
    interval_value: 1,
    interval_unit: "month",
    first_due_date: addDaysDate(30),
    last_due_date: addDaysDate(30 * count),
    config_json: JSON.stringify({ source: "next" }),
  });
  for (let index = 0; index < count; index += 1) {
    await tenantInsert(await tenantTable(slug, "sale_installments"), {
      plan_id: planId,
      sale_id: input.saleId ?? Number(sale?.id ?? 0) ?? 0,
      client_id: client.id > 0 ? client.id : null,
      installment_no: index + 1,
      due_date: addDaysDate(30 * (index + 1)),
      amount: index === count - 1 ? roundMoney(total - amount * (count - 1)) : amount,
      status: "pending",
      payment_type: "card",
    });
  }
  return getSingleInstallmentPlan(slug, planId);
}

export async function payDbInstallment(planId: number, installmentId: number, slug: string): Promise<InstallmentPlan> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sale_installments", where: "plan_id = ? AND id = ?", params: [planId, installmentId], limit: 1 });
  if (!rows[0]) throw new Error("Rata non trovata.");
  if (String(rows[0].status ?? "") === "paid") throw new Error("Rata gia pagata.");
  const amount = Number(rows[0].amount ?? 0);
  await tenantUpdate({ slug, table: "sale_installments", id: installmentId, values: { status: "paid", paid_at: new Date(), paid_amount: amount } });
  const pending = await tenantSelect<RowDataPacket>({ slug, table: "sale_installments", columns: "id", where: "plan_id = ? AND status = 'pending'", params: [planId], limit: 1 });
  if (!pending[0]) await tenantUpdate({ slug, table: "sale_installment_plans", id: planId, values: { status: "completed" } });
  return getSingleInstallmentPlan(slug, planId);
}

export async function listDbCommissions(slug: string): Promise<CommissionEntry[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "staff_commission_payments",
    orderBy: "movement_datetime DESC, id DESC",
  });
  return rows.map(mapCommission);
}

export async function commissionDbSummary(slug: string): Promise<{ open: number; paid: number; reversed: number; dueAmount: number }> {
  const commissions = await listDbCommissions(slug);
  return {
    open: commissions.filter((commission) => commission.status === "open").length,
    paid: commissions.filter((commission) => commission.status === "paid").length,
    reversed: commissions.filter((commission) => commission.status === "reversed").length,
    dueAmount: roundMoney(commissions.filter((commission) => commission.status === "open").reduce((total, commission) => total + commission.amount, 0)),
  };
}

export async function markDbCommissionPaid(id: number, slug: string): Promise<CommissionEntry> {
  await tenantUpdate({ slug, table: "staff_commission_payments", id, values: { is_paid: 1, paid_at: new Date() } });
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "staff_commission_payments", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Commissione non trovata.");
  return mapCommission(rows[0]);
}

export async function listDbAutomationRules(slug: string): Promise<AutomationRule[]> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "automation_settings", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  const createdAt = toIso(row.created_at);
  return [
    { id: 1, name: "Promemoria appuntamento email", channel: "email", trigger: "appointment_reminder", enabled: Number(row.reminder_enabled ?? 1) === 1, createdAt },
    { id: 2, name: "Promemoria appuntamento SMS", channel: "sms", trigger: "appointment_reminder", enabled: Number(row.sms_reminder_enabled ?? 0) === 1, createdAt },
    { id: 3, name: "Appuntamento approvato", channel: "email", trigger: "appointment_reminder", enabled: Number(row.approved_enabled ?? 1) === 1, createdAt },
    { id: 4, name: "Scadenza fidelity", channel: "email", trigger: "fidelity_expiry", enabled: Number(row.fidelity_expiry_reminder_enabled ?? 0) === 1, createdAt },
    { id: 5, name: "Scadenza rata", channel: "browser", trigger: "quote_followup", enabled: Number(row.installment_alert_days ?? 0) > 0, createdAt },
  ];
}

export async function toggleDbAutomationRule(id: number, enabled: boolean, slug: string): Promise<AutomationRule> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "automation_settings", orderBy: "id ASC", limit: 1 });
  if (!rows[0]) throw new Error("Automazione non configurata.");
  const field = automationFieldForId(id);
  if (field) await tenantUpdate({ slug, table: "automation_settings", id: Number(rows[0].id ?? 0), values: { [field]: enabled ? 1 : 0 } });
  const rules = await listDbAutomationRules(slug);
  const rule = rules.find((item) => item.id === id);
  if (!rule) throw new Error("Automazione non trovata.");
  return rule;
}

export async function runDbAutomationRule(id: number, slug: string): Promise<{ rule: AutomationRule; notifications: NotificationItem[] }> {
  const rules = await listDbAutomationRules(slug);
  const rule = rules.find((item) => item.id === id);
  if (!rule) throw new Error("Automazione non trovata.");
  if (!rule.enabled) throw new Error("Automazione disattivata.");
  return {
    rule: { ...rule, lastRunAt: new Date().toISOString() },
    notifications: [{
      id: Date.now(),
      type: "system",
      title: "Automazione eseguita",
      message: rule.name,
      read: false,
      link: "automation",
      createdAt: new Date().toISOString(),
    }],
  };
}

export async function listDbNotifications(slug: string): Promise<NotificationItem[]> {
  const notifications: NotificationItem[] = [];
  const today = todayIso();
  const upcoming = addDaysDate(7);

  try {
    const appointments = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointments",
      where: "DATE(starts_at) BETWEEN ? AND ? AND status IN ('pending','scheduled')",
      params: [today, upcoming],
      orderBy: "starts_at ASC",
      limit: 20,
    });
    appointments.forEach((row) => notifications.push({
      id: 100000 + Number(row.id ?? 0),
      type: "appointment",
      title: "Appuntamento in arrivo",
      message: `Appuntamento #${row.id} del ${String(row.starts_at ?? "").slice(0, 16)}`,
      read: false,
      link: "appointments",
      createdAt: toIso(row.starts_at),
    }));
  } catch {}

  try {
    const costs = await tenantSelect<RowDataPacket>({
      slug,
      table: "costs",
      where: "COALESCE(is_paid, 0) = 0 AND due_date <= ?",
      params: [upcoming],
      orderBy: "due_date ASC",
      limit: 20,
    });
    costs.forEach((row) => notifications.push({
      id: 200000 + Number(row.id ?? 0),
      type: "cost",
      title: "Costo in scadenza",
      message: `${String(row.title ?? "Costo")} - ${roundMoney(Number(row.amount ?? 0))} euro`,
      read: false,
      link: "costs",
      createdAt: toIso(row.due_date),
    }));
  } catch {}

  try {
    const installments = await tenantSelect<RowDataPacket>({
      slug,
      table: "sale_installments",
      where: "status = 'pending' AND due_date <= ?",
      params: [upcoming],
      orderBy: "due_date ASC",
      limit: 20,
    });
    installments.forEach((row) => notifications.push({
      id: 300000 + Number(row.id ?? 0),
      type: "system",
      title: "Rata in scadenza",
      message: `Rata #${row.installment_no} - ${roundMoney(Number(row.amount ?? 0))} euro`,
      read: false,
      link: "installments_manage",
      createdAt: toIso(row.due_date),
    }));
  } catch {}

  return notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markDbNotificationRead(id: number, slug: string): Promise<NotificationItem> {
  const notification = (await listDbNotifications(slug)).find((item) => item.id === id);
  if (!notification) throw new Error("Notifica non trovata.");
  return { ...notification, read: true };
}

export async function listDbConfigModule(moduleId: string, slug: string): Promise<ConfigModuleState> {
  const normalized = normalizeConfigModuleId(moduleId);

  if (normalized === "quote_settings") return quoteSettingsConfig(slug);
  if (normalized === "pos_settings") return posSettingsConfig(slug);
  if (normalized === "business_profile") return businessProfileConfig(slug);
  if (normalized === "package_settings") return packageSettingsConfig(slug);
  if (normalized === "fidelity_membership") return fidelityMembershipConfig(slug);
  if (normalized === "fidelity_levels") return fidelityLevelsConfig(slug);
  if (normalized === "giftbox_settings") return giftboxSettingsConfig(slug);
  if (normalized === "giftcard_settings") return giftcardSettingsConfig(slug);
  if (normalized === "hours") return hoursConfig(slug);
  if (normalized === "roles") return rolesConfig(slug);
  if (normalized === "accessibility") return accessibilityConfig(slug);

  const def = configDefinitions[normalized];
  if (!def) throw new Error("Modulo configurazione non mappato su DB.");
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: def.table,
    where: def.where ?? "",
    orderBy: def.orderBy ?? "id DESC",
    limit: def.limit ?? 200,
  });

  return configStateFromRows(normalized, def.title, def.source, rows.map((row, index) => configRecordFromRow(normalized, row, def, index)));
}

export async function toggleDbConfigRecord(moduleId: string, recordId: number, active: boolean, slug: string): Promise<ConfigModuleState> {
  const normalized = normalizeConfigModuleId(moduleId);
  const def = configDefinitions[normalized];
  if (!def?.activeColumn) throw new Error("Toggle DB non disponibile per questo modulo.");
  await tenantUpdate({ slug, table: def.table, id: recordId, values: { [def.activeColumn]: active ? 1 : 0 } });
  return listDbConfigModule(normalized, slug);
}

export async function touchDbConfigModule(moduleId: string, slug: string): Promise<ConfigModuleState> {
  return listDbConfigModule(moduleId, slug);
}

async function getSingleClient(slug: string, id: number): Promise<ManagedClient> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Cliente non trovato.");
  return mapClient(rows[0]);
}

function mapTransactionMovement(row: RowDataPacket): WalletMovement {
  const points = Math.round(Number(row.delta_points ?? 0));
  return {
    id: Number(row.id ?? 0),
    clientId: Number(row.client_id ?? 0),
    type: points < 0 ? "points_redeem" : points > 0 ? "points_earn" : "adjustment",
    amount: roundMoney(Number(row.amount ?? 0)),
    points,
    note: String(row.note ?? "Movimento punti"),
    source: String(row.source_type ?? row.kind ?? "transactions"),
    createdAt: toIso(row.created_at),
  };
}

function mapCreditAdjustmentMovement(row: RowDataPacket): WalletMovement {
  const amount = roundMoney(Number(row.delta_amount ?? (String(row.direction ?? "") === "debit" ? -Number(row.amount ?? 0) : Number(row.amount ?? 0))));
  return {
    id: Number(row.id ?? 0),
    clientId: Number(row.client_id ?? 0),
    type: amount >= 0 ? "recharge" : "debit",
    amount,
    points: 0,
    note: String(row.note ?? "Movimento credito"),
    source: "credit_adjustments",
    createdAt: toIso(row.created_at),
  };
}

function mapRechargeMovement(row: RowDataPacket): WalletMovement {
  return {
    id: Number(row.id ?? 0),
    clientId: Number(row.client_id ?? 0),
    type: "recharge",
    amount: roundMoney(Number(row.total_amount ?? row.base_amount ?? 0)),
    points: Math.round(Number(row.points_earned ?? 0)),
    note: String(row.note ?? "Ricarica"),
    source: "recharges",
    createdAt: toIso(row.created_at),
  };
}

function normalizeWalletMovementType(type: WalletMovementType | undefined): WalletMovementType {
  if (type === "recharge" || type === "debit" || type === "points_earn" || type === "points_redeem") return type;
  return "adjustment";
}

async function getSingleGiftCard(slug: string, id: number): Promise<GiftCard> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "giftcards", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("GiftCard non trovata.");
  return mapGiftCard(rows[0]);
}

function mapGiftCard(row: RowDataPacket): GiftCard {
  const status = giftCardStatus(String(row.status ?? "active"), String(row.expires_at ?? ""));
  return {
    id: Number(row.id ?? 0),
    code: String(row.code ?? ""),
    clientId: Number(row.client_id ?? 0),
    recipientName: String(row.recipient_name ?? "Destinatario"),
    initialAmount: roundMoney(Number(row.initial_amount ?? 0)),
    balance: roundMoney(Number(row.balance ?? 0)),
    status,
    expiresAt: String(row.expires_at ?? "").slice(0, 10) || addDaysDate(365),
    sourceSaleId: undefined,
    createdAt: toIso(row.issued_at ?? row.created_at),
  };
}

function giftCardStatus(status: string, expiresAt: string): GiftCardStatus {
  if (status === "redeemed") return "used";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "expired" || (expiresAt && expiresAt.slice(0, 10) < todayIso())) return "expired";
  return "active";
}

async function mapPackageCatalog(slug: string, row: RowDataPacket): Promise<PackageCatalog> {
  const id = Number(row.id ?? 0);
  const itemRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "package_items",
    where: "package_id = ?",
    params: [id],
    orderBy: "sort_order ASC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  const items = itemRows.length > 0
    ? await Promise.all(itemRows.map((item) => mapPackageCatalogItem(slug, item)))
    : [await packageCatalogItemFromPackage(slug, row)];

  return {
    id,
    name: String(row.name ?? "Pacchetto"),
    price: roundMoney(Number(row.price ?? 0)),
    items,
    active: Number(row.is_active ?? 1) === 1,
    locationIds: [],
    createdAt: toIso(row.created_at),
  };
}

async function mapPackageCatalogItem(slug: string, row: RowDataPacket): Promise<PackageCatalogItem> {
  const serviceId = Number(row.item_type === "service" ? row.item_id ?? 0 : row.service_id ?? row.item_id ?? 0);
  return {
    serviceId,
    serviceName: await serviceNameById(slug, serviceId, String(row.item_name_snapshot ?? "Servizio")),
    sessions: Math.max(1, Math.round(Number(row.qty ?? 1))),
  };
}

async function packageCatalogItemFromPackage(slug: string, row: RowDataPacket): Promise<PackageCatalogItem> {
  const serviceId = Number(row.service_id ?? 0);
  return {
    serviceId,
    serviceName: await serviceNameById(slug, serviceId, String(row.name ?? "Servizio")),
    sessions: Math.max(1, Math.round(Number(row.sessions_total ?? 1))),
  };
}

async function getSingleClientPackage(slug: string, id: number): Promise<ClientPackage> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "client_packages", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Pacchetto cliente non trovato.");
  return mapClientPackage(slug, rows[0]);
}

async function mapClientPackage(slug: string, row: RowDataPacket): Promise<ClientPackage> {
  const remaining = Math.max(0, Number(row.sessions_remaining ?? 0));
  return {
    id: Number(row.id ?? 0),
    packageId: Number(row.package_id ?? 0),
    clientId: Number(row.client_id ?? 0),
    clientName: await appointmentClientName(slug, Number(row.client_id ?? 0)),
    name: String(row.package_name ?? "Pacchetto"),
    totalSessions: Math.max(0, Number(row.sessions_total ?? remaining)),
    remainingSessions: remaining,
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : undefined,
    status: clientPackageStatus(String(row.status ?? "active"), remaining, String(row.expires_at ?? "")),
    sourceSaleId: row.sale_id ? Number(row.sale_id) : undefined,
    createdAt: toIso(row.created_at ?? row.purchase_date),
  };
}

function clientPackageStatus(status: string, remaining: number, expiresAt: string): ClientPackageStatus {
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "expired" || (expiresAt && expiresAt.slice(0, 10) < todayIso() && remaining > 0)) return "expired";
  if (status === "completed" || remaining <= 0) return "completed";
  return "active";
}

async function insertClientPackageItemsFromCatalog(slug: string, clientPackageId: number, catalog: PackageCatalog): Promise<void> {
  for (const [index, item] of catalog.items.entries()) {
    await tenantInsert(await tenantTable(slug, "client_package_items"), {
      client_package_id: clientPackageId,
      item_type: "service",
      item_id: item.serviceId,
      qty: item.sessions,
      unit_price: 0,
      line_total: 0,
      sort_order: index,
      item_name_snapshot: item.serviceName,
    }).catch(() => 0);
    await tenantInsert(await tenantTable(slug, "client_package_services"), {
      client_package_id: clientPackageId,
      service_id: item.serviceId,
      sessions_total: item.sessions,
      sessions_remaining: item.sessions,
      sort_order: index,
    }).catch(() => 0);
  }
}

async function tryInsertPackageUsage(slug: string, clientPackageId: number, delta: number, note: string): Promise<void> {
  await tenantInsert(await tenantTable(slug, "client_package_usages"), {
    client_package_id: clientPackageId,
    used_at: new Date(),
    delta,
    note,
  }).catch(() => 0);
}

async function getSinglePrepaid(slug: string, id: number): Promise<ClientPrepaid> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "client_prepaid_services", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Prepagato non trovato.");
  return mapClientPrepaid(slug, rows[0]);
}

async function mapClientPrepaid(slug: string, row: RowDataPacket): Promise<ClientPrepaid> {
  const remaining = Math.max(0, Number(row.remaining_qty ?? 0));
  return {
    id: Number(row.id ?? 0),
    clientId: Number(row.client_id ?? 0),
    clientName: await appointmentClientName(slug, Number(row.client_id ?? 0)),
    serviceId: Number(row.service_id ?? 0),
    serviceName: String(row.service_name ?? "Servizio"),
    totalQuantity: Math.max(0, Number(row.purchased_qty ?? remaining)),
    remainingQuantity: remaining,
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : undefined,
    status: clientPrepaidStatus(String(row.status ?? "active"), remaining, String(row.expires_at ?? "")),
    sourceSaleId: row.sale_id ? Number(row.sale_id) : undefined,
    createdAt: toIso(row.created_at ?? row.purchase_date),
  };
}

function clientPrepaidStatus(status: string, remaining: number, expiresAt: string): ClientPrepaidStatus {
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "expired" || (expiresAt && expiresAt.slice(0, 10) < todayIso() && remaining > 0)) return "expired";
  if (status === "completed" || remaining <= 0) return "completed";
  return "active";
}

async function getSinglePreorder(slug: string, id: number): Promise<Preorder> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sale_items", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Preordine non trovato.");
  return mapPreorder(slug, rows[0]);
}

async function mapPreorder(slug: string, row: RowDataPacket): Promise<Preorder> {
  const sale = await getSaleRow(slug, Number(row.sale_id ?? 0));
  return {
    id: Number(row.id ?? 0),
    clientId: Number(sale?.client_id ?? 0),
    clientName: await appointmentClientName(slug, Number(sale?.client_id ?? 0)),
    productId: Number(row.item_id ?? 0),
    productName: String(row.item_name ?? "Prodotto"),
    quantity: Math.max(1, Number(row.qty ?? 1)),
    deposit: roundMoney(Number(sale?.total ?? 0)),
    dueDate: String(row.preorder_expires_at ?? addDaysDate(14)).slice(0, 10),
    status: String(row.item_status ?? "") === "collected" ? "collected" : "open",
    createdAt: toIso(sale?.sale_date ?? sale?.created_at),
    collectedAt: String(row.item_status ?? "") === "collected" ? toIso(sale?.created_at) : undefined,
  };
}

async function getSingleCoupon(slug: string, id: number): Promise<CouponRule> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "coupons", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Coupon non trovato.");
  return mapCoupon(slug, rows[0]);
}

async function getCouponByCode(slug: string, code: string): Promise<CouponRule | null> {
  const normalized = normalizeCouponCode(code);
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "coupons",
    where: "code = ? AND deleted_at IS NULL",
    params: [normalized],
    limit: 1,
  });
  return rows[0] ? mapCoupon(slug, rows[0]) : null;
}

async function mapCoupon(slug: string, row: RowDataPacket): Promise<CouponRule> {
  const code = normalizeCouponCode(String(row.code ?? ""));
  return {
    id: Number(row.id ?? 0),
    code,
    type: String(row.discount_type ?? "") === "fixed" ? "fixed" : "percent",
    value: roundMoney(Number(row.discount_value ?? 0)),
    minSubtotal: roundMoney(Number(row.min_subtotal ?? 0)),
    active: Number(row.is_active ?? 1) === 1 && !row.cancelled_at,
    startsAt: String(row.valid_from ?? todayIso()).slice(0, 10),
    endsAt: String(row.valid_to ?? addDaysDate(30)).slice(0, 10),
    usageLimit: Math.max(0, Math.round(Number(row.usage_limit ?? 0))),
    usedCount: await couponUsageCount(slug, code),
    createdAt: toIso(row.created_at),
  };
}

async function couponUsageCount(slug: string, code: string): Promise<number> {
  let count = 0;
  const params = [code];
  try {
    count += (await tenantSelect<RowDataPacket>({
      slug,
      table: "sales",
      columns: "id",
      where: "coupon_code = ? AND status <> 'cancelled'",
      params,
    })).length;
  } catch {}
  try {
    count += (await tenantSelect<RowDataPacket>({
      slug,
      table: "appointments",
      columns: "id",
      where: "coupon_code = ? AND status <> 'canceled'",
      params,
    })).length;
  } catch {}
  return count;
}

function mapPromotion(row: RowDataPacket): PromotionRule {
  return {
    id: Number(row.id ?? 0),
    name: String(row.title ?? "Promozione"),
    target: promotionTarget(String(row.target_type ?? "all")),
    discountType: String(row.discount_type ?? "") === "fixed" ? "fixed" : "percent",
    discountValue: roundMoney(Number(row.discount_value ?? 0)),
    active: Number(row.is_active ?? 1) === 1,
    startsAt: String(row.starts_at ?? todayIso()).slice(0, 10),
    endsAt: String(row.ends_at ?? addDaysDate(30)).slice(0, 10),
    channel: Number(row.show_in_booking ?? 1) === 1 ? "booking" : String(row.marketplace_visibility ?? "") === "hidden" ? "pos" : "marketplace",
    createdAt: toIso(row.created_at),
  };
}

function promotionTarget(value: string): PromotionRule["target"] {
  if (value === "new") return "new_clients";
  if (value === "inactive" || value === "birthday" || value === "fidelity") return value;
  return "all";
}

async function getSingleGiftBox(slug: string, id: number): Promise<GiftBoxInstance> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "giftbox_instances", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("GiftBox non trovata.");
  return mapGiftBox(slug, rows[0]);
}

async function mapGiftBox(slug: string, row: RowDataPacket): Promise<GiftBoxInstance> {
  const id = Number(row.id ?? 0);
  const items = await giftBoxItems(slug, id);
  const total = items.reduce((sum, item) => sum + item.sessions, 0);
  const redeemed = await giftBoxRedeemedUnits(slug, id);
  return {
    id,
    code: String(row.code ?? ""),
    clientId: Number(row.client_id ?? 0),
    recipientName: String(row.recipient_name ?? "Destinatario"),
    items,
    remainingItems: Math.max(0, total - redeemed),
    status: giftBoxStatus(String(row.status ?? "issued"), String(row.expires_at ?? ""), total - redeemed),
    expiresAt: String(row.expires_at ?? addDaysDate(180)).slice(0, 10),
    sourceSaleId: undefined,
    createdAt: toIso(row.created_at ?? row.issued_at),
  };
}

async function giftBoxItems(slug: string, instanceId: number): Promise<PackageCatalogItem[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "giftbox_instance_items",
    where: "instance_id = ?",
    params: [instanceId],
    orderBy: "sort_order ASC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  return Promise.all(rows.map(async (row) => {
    const serviceId = Number(row.service_id ?? 0);
    return {
      serviceId,
      serviceName: String(row.custom_label ?? "") || await serviceNameById(slug, serviceId, "Servizio"),
      sessions: Math.max(1, Number(row.qty ?? 1)),
    };
  }));
}

async function giftBoxRedeemedUnits(slug: string, instanceId: number): Promise<number> {
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointment_giftbox_items", columns: "qty", where: "instance_id = ? AND redeemed_at IS NOT NULL", params: [instanceId] });
    const appointmentUnits = rows.reduce((sum, row) => sum + Math.max(1, Number(row.qty ?? 1)), 0);
    const manual = await tenantSelect<RowDataPacket>({ slug, table: "giftbox_redemptions", columns: "id", where: "instance_id = ?", params: [instanceId] });
    return appointmentUnits + manual.length;
  } catch {
    return 0;
  }
}

// Units already REDEEMED for a SINGLE giftbox item (instance_id + the item's
// giftbox_instance_items.giftbox_item_id value, NOT the row surrogate id). This is the
// authoritative per-item redeemed count used to compute residual availability, exactly
// like the legacy qb_giftbox_item_remaining: it sums giftbox_redemption_items.qty for
// redemptions of that instance whose redemption-item targets that giftbox_item_id.
//   SUM(ri.qty) FROM giftbox_redemptions r JOIN giftbox_redemption_items ri
//     ON ri.redemption_id = r.id WHERE r.instance_id = ? AND ri.giftbox_item_id = ?
// Recording one redeem (a giftbox_redemptions row + a giftbox_redemption_items row with
// qty 1 for that giftbox_item_id) therefore makes this reflect the consumption — so we
// never double-redeem a unit. Tolerates the redemption tables being absent (-> 0).
async function giftBoxItemRedeemedUnits(slug: string, instanceId: number, giftboxItemId: number): Promise<number> {
  if (instanceId <= 0 || giftboxItemId <= 0) return 0;
  try {
    const headerTable = await tenantTable(slug, "giftbox_redemptions");
    const itemTable = await tenantTable(slug, "giftbox_redemption_items");
    const clauses: string[] = ["r.instance_id = ?", "ri.giftbox_item_id = ?"];
    const params: unknown[] = [instanceId, giftboxItemId];
    // tenantSelect can only scope a single table; this is a JOIN, so scope BOTH
    // shared-mode tables to the tenant explicitly (mirrors tenantSelect's guard).
    if (headerTable.mode === "shared" && (await columnExists(headerTable.name, "tenant_id"))) {
      clauses.push("r.tenant_id = ?");
      params.push(headerTable.tenantId ?? 0);
    }
    if (itemTable.mode === "shared" && (await columnExists(itemTable.name, "tenant_id"))) {
      clauses.push("ri.tenant_id = ?");
      params.push(itemTable.tenantId ?? 0);
    }
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COALESCE(SUM(ri.qty), 0) AS c
         FROM ${quoteIdentifier(itemTable.name)} ri
         JOIN ${quoteIdentifier(headerTable.name)} r ON r.id = ri.redemption_id
        WHERE ${clauses.join(" AND ")}`,
      params,
    );
    return Math.max(0, Number(rows[0]?.c ?? 0) || 0);
  } catch {
    return 0;
  }
}

function giftBoxStatus(status: string, expiresAt: string, remaining: number): GiftBoxStatus {
  if (status === "redeemed" || remaining <= 0) return "redeemed";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "expired" || (expiresAt && expiresAt.slice(0, 10) < todayIso())) return "expired";
  return "active";
}

async function getSingleGift(slug: string, id: number): Promise<GiftReward> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "gift_instances", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Omaggi non trovato.");
  return mapGiftReward(slug, rows[0]);
}

async function mapGiftReward(slug: string, row: RowDataPacket): Promise<GiftReward> {
  const giftId = Number(row.gift_id ?? 0);
  const giftRows = giftId > 0
    ? await tenantSelect<RowDataPacket>({ slug, table: "gifts", where: "id = ?", params: [giftId], limit: 1 }).catch(() => [] as RowDataPacket[])
    : [];
  const gift = giftRows[0] ?? {};
  return {
    id: Number(row.id ?? 0),
    clientId: Number(row.client_id ?? 0),
    clientName: await appointmentClientName(slug, Number(row.client_id ?? 0)),
    title: String(gift.name ?? gift.reward_custom_label ?? "Omaggi"),
    rewardType: giftRewardType(String(gift.reward_type ?? "")),
    value: roundMoney(Number(gift.redeem_points_cost ?? row.points_spent ?? 0)),
    status: giftRewardStatus(String(row.state ?? ""), String(row.expires_at ?? "")),
    expiresAt: String(row.expires_at ?? addDaysDate(60)).slice(0, 10),
    createdAt: toIso(row.created_at),
    redeemedAt: row.redeemed_at ? toIso(row.redeemed_at) : undefined,
  };
}

function giftRewardType(value: string): GiftReward["rewardType"] {
  if (value === "service") return "service";
  if (value === "product") return "product";
  return "discount";
}

function giftRewardStatus(state: string, expiresAt: string): GiftReward["status"] {
  if (state === "riscattato" || state === "redeemed") return "redeemed";
  if (state === "scaduto" || state === "expired" || (expiresAt && expiresAt.slice(0, 10) < todayIso())) return "expired";
  if (state === "annullato" || state === "cancelled" || state === "canceled") return "cancelled";
  return "available";
}

async function ensureDbGiftTemplate(slug: string, input: { title?: string; rewardType?: GiftReward["rewardType"]; value?: number }): Promise<number> {
  const title = normalizeName(input.title, "Omaggi manuale");
  const existing = await tenantSelect<RowDataPacket>({
    slug,
    table: "gifts",
    columns: "id",
    where: "name = ? AND deleted_at IS NULL",
    params: [title],
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  if (existing[0]) return Number(existing[0].id ?? 0);
  return tenantInsert(await tenantTable(slug, "gifts"), {
    name: title,
    description: title,
    eligibility: "all_clients",
    reward_type: input.rewardType === "service" || input.rewardType === "product" ? input.rewardType : "custom",
    reward_custom_label: title,
    redeem_points_enabled: 0,
    redeem_points_cost: roundMoney(Number(input.value ?? 0)),
    active: 1,
  });
}

async function getSingleInstallmentPlan(slug: string, id: number): Promise<InstallmentPlan> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sale_installment_plans", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Piano rateale non trovato.");
  return mapInstallmentPlan(slug, rows[0]);
}

async function mapInstallmentPlan(slug: string, row: RowDataPacket): Promise<InstallmentPlan> {
  const id = Number(row.id ?? 0);
  const installmentRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "sale_installments",
    where: "plan_id = ?",
    params: [id],
    orderBy: "installment_no ASC, id ASC",
  });
  const installments = installmentRows.map(mapInstallment);
  const paid = roundMoney(installments.filter((item) => item.status === "paid").reduce((total, item) => total + item.amount, 0));
  const total = roundMoney(Number(row.sale_total ?? row.financed_amount ?? 0));
  return {
    id,
    saleId: Number(row.sale_id ?? 0),
    clientId: Number(row.client_id ?? 0),
    clientName: await appointmentClientName(slug, Number(row.client_id ?? 0)),
    total,
    paid,
    status: installmentPlanStatus(String(row.status ?? "active"), total, paid, installments),
    installments,
    createdAt: toIso(row.created_at),
  };
}

function mapInstallment(row: RowDataPacket): Installment {
  const rawStatus = String(row.status ?? "pending");
  const dueDate = String(row.due_date ?? todayIso()).slice(0, 10);
  return {
    id: Number(row.id ?? 0),
    dueDate,
    amount: roundMoney(Number(row.amount ?? 0)),
    status: installmentStatus(rawStatus, dueDate),
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
  };
}

function installmentStatus(status: string, dueDate: string): InstallmentStatus {
  if (status === "paid") return "paid";
  if (status === "pending" && dueDate < todayIso()) return "overdue";
  return "due";
}

function installmentPlanStatus(status: string, total: number, paid: number, installments: Installment[]): InstallmentPlanStatus {
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "completed" || paid + 0.00001 >= total || installments.every((item) => item.status === "paid")) return "completed";
  return "active";
}

function mapCommission(row: RowDataPacket): CommissionEntry {
  return {
    id: Number(row.id ?? 0),
    staffName: String(row.operator_name ?? row.staff_name ?? `Operatore #${row.staff_id ?? 0}`),
    saleId: String(row.source_group ?? "") === "sale" || String(row.source_reference ?? "").includes("sale") ? Number(row.source_id ?? 0) || undefined : undefined,
    appointmentId: String(row.source_group ?? "") === "appointment" ? Number(row.source_id ?? 0) || undefined : undefined,
    baseAmount: roundMoney(Number(row.base_amount ?? 0)),
    rate: roundMoney(Number(row.percent_value ?? 0)),
    amount: roundMoney(Number(row.commission_amount ?? 0)),
    status: commissionStatus(row),
    createdAt: toIso(row.movement_datetime ?? row.created_at),
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
  };
}

function commissionStatus(row: RowDataPacket): CommissionStatus {
  const entryStatus = String(row.entry_status ?? "active");
  if (entryStatus === "cancelled" || entryStatus === "reversed") return "reversed";
  if (Number(row.is_paid ?? 0) === 1) return "paid";
  return "open";
}

function automationFieldForId(id: number): string | null {
  if (id === 1) return "reminder_enabled";
  if (id === 2) return "sms_reminder_enabled";
  if (id === 3) return "approved_enabled";
  if (id === 4) return "fidelity_expiry_reminder_enabled";
  return null;
}

async function getSaleRow(slug: string, saleId: number): Promise<RowDataPacket | null> {
  if (saleId <= 0) return null;
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "sales", where: "id = ?", params: [saleId], limit: 1 });
  return rows[0] ?? null;
}

async function serviceNameById(slug: string, serviceId: number, fallback: string): Promise<string> {
  if (serviceId <= 0) return fallback;
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "services", columns: "name", where: "id = ?", params: [serviceId], limit: 1 }).catch(() => [] as RowDataPacket[]);
  return String(rows[0]?.name ?? fallback);
}

type ConfigDef = {
  title: string;
  source: string;
  table: string;
  titleColumn: string;
  detailColumns?: string[];
  valueColumn?: string;
  activeColumn?: string;
  where?: string;
  orderBy?: string;
  limit?: number;
};

const configDefinitions: Record<string, ConfigDef> = {
  cost_categories: {
    title: "Categorie costi",
    source: "costs.php?tab=categories",
    table: "cost_categories",
    titleColumn: "name",
    valueColumn: "color",
    activeColumn: "is_active",
    orderBy: "name ASC",
  },
  product_categories: {
    title: "Categorie prodotti",
    source: "products.php?action=categories",
    table: "product_categories",
    titleColumn: "name",
    valueColumn: "created_at",
    orderBy: "name ASC",
  },
  stock_moves: {
    title: "Carico / Scarico",
    source: "stock_moves.php",
    table: "stock_moves",
    titleColumn: "cause",
    detailColumns: ["document_type", "document_number", "operator_name"],
    valueColumn: "qty",
    orderBy: "move_date DESC, id DESC",
  },
  suppliers: {
    title: "Fornitori",
    source: "suppliers.php",
    table: "suppliers",
    titleColumn: "name",
    detailColumns: ["business_name", "email", "city"],
    valueColumn: "phone",
    activeColumn: "is_active",
    orderBy: "name ASC",
  },
  client_sheets: {
    title: "Schede cliente",
    source: "client_sheets.php",
    table: "client_sheet_templates",
    titleColumn: "title",
    detailColumns: ["description", "slug"],
    valueColumn: "fields_json",
    activeColumn: "is_active",
    where: "deleted_at IS NULL",
    orderBy: "title ASC",
  },
  client_sheet_templates: {
    title: "Template schede",
    source: "client_sheet_templates.php",
    table: "client_sheet_presets",
    titleColumn: "name",
    detailColumns: ["category", "slug"],
    valueColumn: "fields_json",
    activeColumn: "is_active",
    orderBy: "sort_order ASC, name ASC",
  },
  client_consents: {
    title: "Consensi cliente",
    source: "client_consents.php",
    table: "consent_modules",
    titleColumn: "name",
    detailColumns: ["type", "slug"],
    valueColumn: "footer_mode",
    activeColumn: "is_active",
    orderBy: "sort_order ASC, name ASC",
  },
  consent_modules: {
    title: "Moduli consenso",
    source: "consent_modules.php",
    table: "consent_modules",
    titleColumn: "name",
    detailColumns: ["type", "slug"],
    valueColumn: "footer_mode",
    activeColumn: "is_active",
    orderBy: "sort_order ASC, name ASC",
  },
  resources: {
    title: "Risorse",
    source: "resources.php",
    table: "resources",
    titleColumn: "name",
    detailColumns: ["description"],
    valueColumn: "qty_total",
    orderBy: "name ASC",
  },
  service_categories: {
    title: "Categorie servizi",
    source: "services.php?tab=categories",
    table: "service_categories",
    titleColumn: "name",
    detailColumns: ["image_url"],
    valueColumn: "sort_order",
    orderBy: "sort_order ASC, name ASC",
  },
  service_recommendations: {
    title: "Servizi consigliati",
    source: "services.php?tab=recommended",
    table: "service_recommendations",
    titleColumn: "service_id",
    detailColumns: ["recommended_service_id"],
    valueColumn: "sort_order",
    orderBy: "sort_order ASC",
  },
  cabins: {
    title: "Cabine",
    source: "cabins.php",
    table: "cabins",
    titleColumn: "name",
    detailColumns: ["location_id"],
    valueColumn: "position",
    activeColumn: "is_active",
    orderBy: "position ASC, name ASC",
  },
  staff: {
    title: "Operatori",
    source: "staff.php",
    table: "staff",
    titleColumn: "full_name",
    detailColumns: ["email", "phone"],
    valueColumn: "calendar_color",
    activeColumn: "is_active",
    orderBy: "full_name ASC",
  },
  staff_availability: {
    title: "Disponibilita",
    source: "staff_availability.php",
    table: "staff_availability",
    titleColumn: "kind",
    detailColumns: ["staff_id", "starts_at", "ends_at"],
    valueColumn: "location_id",
    orderBy: "starts_at DESC, id DESC",
  },
  locations: {
    title: "Sedi",
    source: "locations.php",
    table: "locations",
    titleColumn: "name",
    detailColumns: ["address", "email", "phone"],
    valueColumn: "booking_enabled",
    activeColumn: "is_active",
    orderBy: "sort_order ASC, name ASC",
  },
  marketplace: {
    title: "Marketplace",
    source: "marketplace.php",
    table: "marketplace_activity_categories",
    titleColumn: "name",
    detailColumns: ["slug", "icon_key"],
    valueColumn: "sort_order",
    activeColumn: "is_active",
    orderBy: "sort_order ASC, name ASC",
  },
};

async function quoteSettingsConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  return configStateFromRows("quote_settings", "Impostazioni preventivi", "quote_settings.php", [
    configRecord("quote_settings", 1, "Intestazione", String(row.quote_company_name ?? row.name ?? "Attivita"), String(row.quote_email ?? row.email ?? ""), true, row.created_at),
    configRecord("quote_settings", 2, "Dati fiscali", [row.quote_vat_number, row.quote_tax_code, row.quote_sdi].filter(Boolean).join(" / ") || "-", String(row.quote_city ?? ""), true, row.created_at),
    configRecord("quote_settings", 3, "Footer preventivo", String(row.quote_footer ?? ""), String(row.quote_terms ?? ""), true, row.created_at),
    configRecord("quote_settings", 4, "Metodi pagamento", String(row.payment_methods ?? ""), "Configurazione preventivi", true, row.created_at),
  ]);
}

async function posSettingsConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "pos_settings", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  return configStateFromRows("pos_settings", "Impostazioni POS", "pos_settings.php", [
    configRecord("pos_settings", 1, "Scadenza preordini", `${row.preorders_expiry_value ?? 0} ${row.preorders_expiry_unit ?? "days"}`, Number(row.preorders_expiry_enabled ?? 0) === 1 ? "Attiva" : "Disattiva", Number(row.preorders_expiry_enabled ?? 0) === 1, row.updated_at),
    configRecord("pos_settings", 2, "Scadenza prepagati", `${row.prepaids_expiry_value ?? 0} ${row.prepaids_expiry_unit ?? "days"}`, Number(row.prepaids_expiry_enabled ?? 0) === 1 ? "Attiva" : "Disattiva", Number(row.prepaids_expiry_enabled ?? 0) === 1, row.updated_at),
  ]);
}

async function businessProfileConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  return configStateFromRows("business_profile", "Profilo attivita", "business_profile.php", [
    configRecord("business_profile", 1, String(row.name ?? "Attivita"), String(row.booking_about_text ?? ""), String(row.website ?? ""), true, row.created_at),
    configRecord("business_profile", 2, "Contatti", [row.email, row.phone].filter(Boolean).join(" / "), String(row.address ?? ""), true, row.created_at),
    configRecord("business_profile", 3, "Booking staff", "Scelta operatore nel booking", Number(row.booking_choose_staff_enabled ?? 0) === 1 ? "Attiva" : "Disattiva", Number(row.booking_choose_staff_enabled ?? 0) === 1, row.created_at),
    configRecord("business_profile", 4, "Prodotti booking", "Prodotti vendibili nel booking", Number(row.booking_products_enabled ?? 0) === 1 ? "Attivi" : "Disattivi", Number(row.booking_products_enabled ?? 0) === 1, row.created_at),
  ]);
}

async function packageSettingsConfig(slug: string): Promise<ConfigModuleState> {
  const [businessRows, packageRows] = await Promise.all([
    tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 }),
    tenantSelect<RowDataPacket>({ slug, table: "packages", orderBy: "name ASC", limit: 200 }),
  ]);
  const row = businessRows[0] ?? {};
  const activePackages = packageRows.filter((item) => Number(item.is_active ?? 1) === 1).length;
  return configStateFromRows("package_settings", "Impostazioni pacchetti", "packages.php?tab=settings", [
    configRecord("package_settings", 1, "Validita predefinita", `${row.package_default_validity_value ?? 0} ${row.package_default_validity_unit ?? "days"}`, "Default vendita", true, row.created_at),
    configRecord("package_settings", 2, "Catalogo pacchetti", `${packageRows.length} pacchetti configurati`, `${activePackages} attivi`, activePackages > 0, row.created_at),
  ]);
}

async function fidelityMembershipConfig(slug: string): Promise<ConfigModuleState> {
  const [businessRows, cardRows] = await Promise.all([
    tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 }),
    tenantSelect<RowDataPacket>({ slug, table: "cards", orderBy: "created_at DESC, id DESC", limit: 200 }),
  ]);
  const row = businessRows[0] ?? {};
  const enabled = Number(row.fidelity_enabled ?? 0) === 1;
  const activeCards = cardRows.filter((item) => String(item.status ?? "active") === "active").length;
  return configStateFromRows("fidelity_membership", "Adesione", "fidelity_membership.php", [
    configRecord("fidelity_membership", 1, "Programma fidelity", enabled ? "Fidelity abilitata" : "Fidelity disabilitata", enabled ? "Attivo" : "Disattivo", enabled, row.created_at),
    configRecord("fidelity_membership", 2, "Regole adesione", String(row.fidelity_adhesion_json ?? ""), row.fidelity_adhesion_json ? "Configurate" : "Da configurare", enabled, row.created_at),
    configRecord("fidelity_membership", 3, "Tessere clienti", `${cardRows.length} tessere emesse`, `${activeCards} attive`, activeCards > 0, row.created_at),
  ]);
}

async function fidelityLevelsConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  const enabled = Number(row.fidelity_levels_enabled ?? 0) === 1;
  return configStateFromRows("fidelity_levels", "Livelli Card", "fidelity_points.php#livelli-card", [
    configRecord("fidelity_levels", 1, "Livelli card", String(row.fidelity_card_levels_json ?? ""), enabled ? "Attivi" : "Disattivi", enabled, row.created_at),
    configRecord("fidelity_levels", 2, "Soglia Silver", `${row.fidelity_silver_threshold ?? 0} punti`, "Silver", enabled, row.created_at),
    configRecord("fidelity_levels", 3, "Soglia Gold", `${row.fidelity_gold_threshold ?? 0} punti`, "Gold", enabled, row.created_at),
    configRecord("fidelity_levels", 4, "Periodo livello", `${row.fidelity_level_period_days ?? 365} giorni`, "Validita calcolo", enabled, row.created_at),
  ]);
}

async function giftboxSettingsConfig(slug: string): Promise<ConfigModuleState> {
  const [businessRows, giftboxRows] = await Promise.all([
    tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 }),
    tenantSelect<RowDataPacket>({ slug, table: "giftboxes", where: "deleted_at IS NULL", orderBy: "sort_order ASC, name ASC", limit: 200 }),
  ]);
  const row = businessRows[0] ?? {};
  const activeGiftboxes = giftboxRows.filter((item) => Number(item.active ?? 1) === 1).length;
  return configStateFromRows("giftbox_settings", "Impostazioni GiftBox", "giftbox_settings.php", [
    configRecord("giftbox_settings", 1, "Validita predefinita", `${row.giftbox_default_validity_value ?? 0} ${row.giftbox_default_validity_unit ?? "days"}`, "Default emissione", true, row.created_at),
    configRecord("giftbox_settings", 2, "Termini GiftBox", String(row.giftbox_terms ?? ""), row.giftbox_terms ? "Configurati" : "Da configurare", true, row.created_at),
    configRecord("giftbox_settings", 3, "Catalogo GiftBox", `${giftboxRows.length} template`, `${activeGiftboxes} attivi`, activeGiftboxes > 0, row.created_at),
  ]);
}

async function giftcardSettingsConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 });
  const row = rows[0] ?? {};
  return configStateFromRows("giftcard_settings", "Impostazioni GiftCard", "giftcard_settings.php", [
    configRecord("giftcard_settings", 1, "Validita predefinita", `${row.giftcard_default_validity_value ?? 0} ${row.giftcard_default_validity_unit ?? "days"}`, "Default emissione", true, row.created_at),
    configRecord("giftcard_settings", 2, "Termini GiftCard", String(row.giftcard_terms ?? ""), row.giftcard_terms ? "Configurati" : "Da configurare", true, row.created_at),
    configRecord("giftcard_settings", 3, "Voucher pubblico", "Token pubblico, importo nascosto e invio email", "Gestito da giftcard.php", true, row.created_at),
  ]);
}

async function hoursConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "business_hours", orderBy: "location_id ASC, dow ASC, id ASC" });
  const records = rows.map((row, index) => configRecord(
    "hours",
    Number(row.id ?? index + 1),
    `Giorno ${row.dow ?? ""} - sede ${row.location_id ?? "default"}`,
    Number(row.is_closed ?? 0) === 1 ? "Chiuso" : [row.opens, row.closes, row.opens2, row.closes2].filter(Boolean).join(" / "),
    Number(row.is_closed ?? 0) === 1 ? "Chiuso" : "Aperto",
    Number(row.is_closed ?? 0) !== 1,
    new Date(),
  ));
  return configStateFromRows("hours", "Orari", "hours.php", records);
}

async function rolesConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "role_permissions", orderBy: "role ASC, perm ASC" });
  const grouped = new Map<string, number>();
  rows.forEach((row) => grouped.set(String(row.role ?? "ruolo"), (grouped.get(String(row.role ?? "ruolo")) ?? 0) + 1));
  const records = Array.from(grouped.entries()).map(([role, count], index) => configRecord("roles", index + 1, role, `${count} permessi`, "Configurato", true, new Date()));
  return configStateFromRows("roles", "Ruoli", "roles.php", records);
}

async function accessibilityConfig(slug: string): Promise<ConfigModuleState> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "users", orderBy: "email ASC" });
  const records = rows.map((row, index) => configRecord(
    "accessibility",
    Number(row.id ?? index + 1),
    String(row.email ?? "Utente"),
    String(row.role ?? ""),
    row.email_verified_at ? "Verificata" : "Da verificare",
    Boolean(row.email_verified_at),
    row.created_at,
  ));
  return configStateFromRows("accessibility", "Accessibilita", "accessibility.php", records);
}

function configStateFromRows(id: string, title: string, source: string, records: ConfigRecord[]): ConfigModuleState {
  return {
    id,
    title,
    source,
    records,
    settings: { sourceMode: "database", source },
    updatedAt: new Date().toISOString(),
  };
}

function configRecordFromRow(moduleId: string, row: RowDataPacket, def: ConfigDef, index: number): ConfigRecord {
  const id = Number(row.id ?? index + 1);
  const detail = (def.detailColumns ?? [])
    .map((column) => String(row[column] ?? "").trim())
    .filter(Boolean)
    .join(" / ");
  const active = def.activeColumn ? Number(row[def.activeColumn] ?? 1) === 1 : true;
  return configRecord(
    moduleId,
    id,
    String(row[def.titleColumn] ?? `${def.title} #${id}`),
    detail || def.title,
    def.valueColumn ? String(row[def.valueColumn] ?? "") : active ? "Attivo" : "Disattivo",
    active,
    row.updated_at ?? row.created_at,
  );
}

function configRecord(moduleId: string, id: number, title: string, detail: string, value: string, active: boolean, updatedAt: unknown): ConfigRecord {
  return {
    id,
    module: moduleId,
    title: title || `${moduleId} #${id}`,
    detail,
    value,
    active,
    updatedAt: toIso(updatedAt),
  };
}

function normalizeConfigModuleId(moduleId: string): string {
  return (moduleId || "custom").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function mapLocation(slug: string, row: RowDataPacket): Location {
  const id = Number(row.id ?? 0);
  const name = String(row.name ?? `Sede ${id}`);
  return {
    id,
    tenantSlug: slug,
    slug: `${slug}-${slugSegment(name)}-${id}`,
    name,
    address: String(row.address ?? row.legal_address ?? ""),
    city: String(row.legal_city ?? ""),
    area: String(row.legal_province ?? row.legal_region ?? ""),
    phone: String(row.phone ?? row.legal_phone ?? ""),
    hoursToday: "Orari configurati",
    bookingEnabled: Number(row.booking_enabled ?? 0) === 1,
    marketplaceEnabled: Number(row.marketplace_enabled ?? 0) === 1,
  };
}

async function mapSale(slug: string, row: RowDataPacket): Promise<PosSale> {
  const id = Number(row.id ?? 0);
  const items = await saleItems(slug, id);
  const total = Number(row.total ?? 0);
  const clientName = await appointmentClientName(slug, Number(row.client_id ?? 0));
  const status = String(row.status ?? "active") === "cancelled" ? "cancelled" : "active";

  return {
    id,
    code: `S-${String(id).padStart(5, "0")}`,
    clientId: Number(row.client_id ?? 0),
    clientName,
    appointmentId: undefined,
    locationId: Number(row.location_id ?? 0),
    items,
    payments: [{ id: 1, method: "card", amount: total }],
    subtotal: Number(row.subtotal ?? total),
    discount: Number(row.discount ?? 0),
    total,
    paidAmount: total,
    changeDue: 0,
    status,
    createdAt: toIso(row.sale_date ?? row.created_at),
    cancelledAt: row.cancelled_at ? toIso(row.cancelled_at) : undefined,
    cancelReason: row.cancelled_reason ? String(row.cancelled_reason) : undefined,
  };
}

async function saleItems(slug: string, saleId: number): Promise<PosSaleItem[]> {
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "sale_items",
      where: "sale_id = ?",
      params: [saleId],
      orderBy: "id ASC",
    });
    return rows.map((row) => {
      const itemType = String(row.item_type ?? "");
      return {
        id: Number(row.id ?? 0),
        type: itemType === "product" ? "product" : itemType === "giftcard" ? "giftcard" : itemType === "prepaid" ? "prepaid" : "service",
        refId: Number(row.item_id ?? 0),
        name: String(row.item_name ?? "Voce"),
        quantity: Number(row.qty ?? 1),
        unitPrice: Number(row.unit_price ?? 0),
        total: Number(row.line_total ?? 0),
        status: String(row.item_status ?? "") === "ordered" ? "ordered" : itemType === "product" ? "collected" : "executed",
      } satisfies PosSaleItem;
    });
  } catch {
    return [];
  }
}

async function resolveSaleClientForDb(slug: string, clientId: number, clientName?: string): Promise<{ id: number; name: string }> {
  if (clientId > 0) {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "id,full_name", where: "id = ?", params: [clientId], limit: 1 });
    if (rows[0]) return { id: Number(rows[0].id), name: String(rows[0].full_name ?? "Cliente") };
  }
  const name = normalizeName(clientName, "Cliente banco");
  if (name === "Cliente banco") return { id: 0, name };
  const created = await createDbClient({ name }, slug);
  return { id: created.id, name: created.name };
}

async function buildDbSaleItem(slug: string, input: PosCheckoutInput["items"][number], id: number): Promise<PosSaleItem> {
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const refId = input.refId && input.refId > 0 ? input.refId : 0;
  if (input.type === "service") {
    const service = refId > 0 ? await getSingleService(slug, refId) : null;
    const unitPrice = roundMoney(input.unitPrice ?? parseMoney(service?.price ?? "0", 0));
    return {
      id,
      type: "service",
      refId: service?.id ?? refId,
      name: input.name?.trim() || service?.name || "Servizio",
      quantity,
      unitPrice,
      total: roundMoney(unitPrice * quantity),
      status: input.status ?? "executed",
    };
  }
  if (input.type === "product") {
    const product = refId > 0 ? await getSingleProduct(slug, refId) : null;
    const unitPrice = roundMoney(input.unitPrice ?? parseMoney(product?.price ?? "0", 0));
    return {
      id,
      type: "product",
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
    type: input.type,
    refId,
    name: input.name?.trim() || (input.type === "giftcard" ? "GiftCard" : input.type === "package" ? "Pacchetto" : input.type === "giftbox" ? "GiftBox" : "Prepagato"),
    quantity,
    unitPrice,
    total: roundMoney(unitPrice * quantity),
    status: input.status ?? "prepaid",
  };
}

async function decrementProductStock(slug: string, productId: number, quantity: number): Promise<void> {
  const product = await getSingleProduct(slug, productId);
  const nextStock = product.stock - quantity;
  if (nextStock < 0) throw new Error(`Giacenza insufficiente per ${product.name}.`);
  await tenantUpdate({ slug, table: "products", id: productId, values: { stock: nextStock } });
}

async function incrementProductStock(slug: string, productId: number, quantity: number): Promise<void> {
  const product = await getSingleProduct(slug, productId);
  await tenantUpdate({ slug, table: "products", id: productId, values: { stock: product.stock + quantity } });
}

async function issueDbPrepaidFromSale({ slug, saleId, saleItemId, clientId, item }: { slug: string; saleId: number; saleItemId: number; clientId: number; item: PosSaleItem }): Promise<void> {
  try {
    const service = item.refId > 0 ? await getSingleService(slug, item.refId) : null;
    await tenantInsert(await tenantTable(slug, "client_prepaid_services"), {
      client_id: clientId,
      sale_id: saleId,
      sale_item_id: saleItemId,
      service_id: service?.id ?? item.refId,
      service_name: service?.name ?? item.name,
      purchased_qty: item.quantity,
      remaining_qty: item.quantity,
      unit_price: item.unitPrice,
      total_paid: item.total,
      status: "active",
    });
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

async function issueDbPackageFromSale({ slug, saleId, clientId, item }: { slug: string; saleId: number; clientId: number; item: PosSaleItem }): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "client_packages"), {
      client_id: clientId,
      package_id: item.refId > 0 ? item.refId : null,
      package_name: item.name,
      purchase_date: todayIso(),
      start_date: todayIso(),
      sessions_total: item.quantity,
      sessions_remaining: item.quantity,
      status: "active",
      sale_id: saleId,
    });
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

async function issueDbGiftCardFromSale({ slug, clientId, recipientName, amount, locationId }: { slug: string; clientId: number; recipientName: string; amount: number; locationId: number | null }): Promise<void> {
  try {
    const code = `GC${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const giftCardId = await tenantInsert(await tenantTable(slug, "giftcards"), {
      code,
      client_id: clientId,
      recipient_name: recipientName,
      initial_amount: amount,
      balance: amount,
      status: "active",
      issued_at: new Date(),
      expires_at: addDaysDate(365),
      location_id: locationId,
    });
    await tenantInsert(await tenantTable(slug, "giftcard_transactions"), {
      giftcard_id: giftCardId,
      type: "issue",
      amount,
      note: "Emissione da vendita Next",
      created_at: new Date(),
      location_id: locationId,
    });
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

async function createDbInstallmentPlanFromSale({ slug, saleId, clientId, total, count }: { slug: string; saleId: number; clientId: number; total: number; count: number }): Promise<void> {
  try {
    const installmentCount = Math.max(1, Math.round(count));
    const amount = roundMoney(total / installmentCount);
    const planId = await tenantInsert(await tenantTable(slug, "sale_installment_plans"), {
      sale_id: saleId,
      client_id: clientId,
      payment_type: "card",
      status: "active",
      sale_total: total,
      down_payment_amount: 0,
      financed_amount: total,
      installments_count: installmentCount,
      interval_value: 1,
      interval_unit: "month",
      first_due_date: addDaysDate(30),
      last_due_date: addDaysDate(30 * installmentCount),
      config_json: JSON.stringify({ source: "next" }),
    });
    for (let index = 0; index < installmentCount; index += 1) {
      await tenantInsert(await tenantTable(slug, "sale_installments"), {
        plan_id: planId,
        sale_id: saleId,
        client_id: clientId,
        installment_no: index + 1,
        due_date: addDaysDate(30 * (index + 1)),
        amount: index === installmentCount - 1 ? roundMoney(total - amount * (installmentCount - 1)) : amount,
        status: "pending",
        payment_type: "card",
      });
    }
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

async function cancelDbSaleResidues(slug: string, saleId: number): Promise<void> {
  await tenantUpdateBySaleId(slug, "client_prepaid_services", saleId, { status: "cancelled", canceled_at: new Date() });
  await tenantUpdateBySaleId(slug, "client_packages", saleId, { status: "cancelled" });
  await tenantUpdateBySaleId(slug, "sale_installment_plans", saleId, { status: "cancelled", cancelled_at: new Date(), cancelled_reason: "Vendita annullata" });
  await tenantUpdateBySaleId(slug, "sale_installments", saleId, { status: "cancelled", note: "Vendita annullata" });
}

async function tenantUpdateBySaleId(slug: string, table: string, saleId: number, values: Record<string, unknown>): Promise<void> {
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table, columns: "id", where: "sale_id = ?", params: [saleId] });
    for (const row of rows) {
      await tenantUpdate({ slug, table, id: Number(row.id), values });
    }
  } catch {
    // Optional module/table can be absent in older installs.
  }
}

async function mapCost(slug: string, row: RowDataPacket): Promise<CostItem> {
  const paid = Number(row.is_paid ?? 0) === 1;
  const dueDate = String(row.due_date ?? todayIso()).slice(0, 10);
  return {
    id: Number(row.id ?? 0),
    title: String(row.title ?? "Costo"),
    category: await costCategoryName(slug, Number(row.category_id ?? 0)),
    supplier: row.supplier_id ? `Fornitore #${row.supplier_id}` : "-",
    amount: Number(row.amount ?? 0),
    dueDate,
    recurrence: Number(row.is_recurring ?? 0) === 1 ? recurrenceFromDb(String(row.recurrence_unit ?? "")) : "none",
    locationId: Number(row.location_id ?? 0),
    status: paid ? "paid" : dueDate < todayIso() ? "overdue" : "open",
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
    createdAt: toIso(row.created_at),
  };
}

async function costCategoryName(slug: string, categoryId: number): Promise<string> {
  if (categoryId <= 0) return "Generale";
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "cost_categories", columns: "name", where: "id = ?", params: [categoryId], limit: 1 });
    return String(rows[0]?.name ?? "Generale");
  } catch {
    return "Generale";
  }
}

function recurrenceFromDb(unit: string): CostItem["recurrence"] {
  if (unit === "month" || unit === "months" || unit === "monthly") return "monthly";
  if (unit === "year" || unit === "years" || unit === "yearly") return "yearly";
  return "none";
}

async function mapQuote(slug: string, row: RowDataPacket): Promise<Quote> {
  const id = Number(row.id ?? 0);
  const lines = await quoteLines(slug, id);
  const status = quoteStatus(String(row.status ?? "draft"));
  return {
    id,
    code: String(row.number ?? `Q-${String(id).padStart(5, "0")}`),
    clientId: Number(row.client_id ?? 0),
    clientName: String(row.client_name ?? row.client_company_name ?? "Cliente"),
    lines,
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount_total ?? 0),
    total: Number(row.total ?? 0),
    status,
    publicToken: String(row.public_token ?? ""),
    expiresAt: String(row.valid_until ?? "").slice(0, 10) || todayIso(),
    acceptedAt: row.customer_decision_at ? toIso(row.customer_decision_at) : undefined,
    convertedSaleId: Number(row.converted_sale_id ?? 0) || undefined,
    createdAt: toIso(row.created_at),
  };
}

async function quoteLines(slug: string, quoteId: number): Promise<QuoteLine[]> {
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "quote_items",
      where: "quote_id = ?",
      params: [quoteId],
      orderBy: "position ASC, id ASC",
    });
    return rows.map((row) => ({
      id: Number(row.id ?? 0),
      type: String(row.item_type ?? "") === "product" ? "product" : "service",
      refId: Number(row.item_id ?? 0),
      name: String(row.description ?? "Voce"),
      quantity: Number(row.qty ?? 1),
      unitPrice: Number(row.unit_price ?? 0),
      total: Number(row.line_total ?? 0),
    }));
  } catch {
    return [];
  }
}

function quoteStatus(status: string): QuoteStatus {
  if (status === "sent") return "sent";
  if (status === "accepted") return "accepted";
  if (status === "converted") return "converted";
  if (status === "rejected" || status === "declined") return "rejected";
  return "draft";
}

async function mapAppointment(slug: string, row: RowDataPacket): Promise<AppointmentWithMeta> {
  const clientName = await appointmentClientName(slug, Number(row.client_id ?? 0));
  const service = await appointmentService(slug, row);
  const staffName = await appointmentStaffName(slug, Number(row.id ?? 0));
  const startsAt = toDate(row.starts_at);

  return {
    id: Number(row.id ?? 0),
    date: dateIsoLocal(startsAt),
    locationId: row.location_id === null || row.location_id === undefined ? null : Number(row.location_id),
    time: timeLocal(startsAt),
    client: clientName,
    service: service.name,
    operator: staffName,
    room: row.cabin_id ? `Cabina #${row.cabin_id}` : "-",
    price: `${roundMoney(service.price)} euro`,
    status: uiStatus(String(row.status ?? "")),
  };
}

async function appointmentClientName(slug: string, clientId: number): Promise<string> {
  if (clientId <= 0) return "Cliente";
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "full_name,email", where: "id = ?", params: [clientId], limit: 1 });
    return String(rows[0]?.full_name ?? rows[0]?.email ?? "Cliente");
  } catch {
    return "Cliente";
  }
}

async function appointmentService(slug: string, appointment: RowDataPacket): Promise<{ name: string; price: number }> {
  const appointmentId = Number(appointment.id ?? 0);
  try {
    const serviceRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointment_services",
      columns: "service_name,price",
      where: "appointment_id = ?",
      params: [appointmentId],
      limit: 1,
    });
    if (serviceRows[0]) return { name: String(serviceRows[0].service_name ?? "Servizio"), price: Number(serviceRows[0].price ?? 0) };
  } catch {
    // fallback below
  }

  const serviceId = Number(appointment.service_id ?? 0);
  if (serviceId > 0) {
    try {
      const rows = await tenantSelect<RowDataPacket>({ slug, table: "services", columns: "name,price", where: "id = ?", params: [serviceId], limit: 1 });
      if (rows[0]) return { name: String(rows[0].name ?? "Servizio"), price: Number(rows[0].price ?? 0) };
    } catch {
      // fallback below
    }
  }

  return { name: "Servizio", price: 0 };
}

async function appointmentStaffName(slug: string, appointmentId: number): Promise<string> {
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "appointment_staff", columns: "staff_id", where: "appointment_id = ?", params: [appointmentId], limit: 1 });
    const staffId = Number(rows[0]?.staff_id ?? 0);
    if (staffId <= 0) return "";
    const staff = await tenantSelect<RowDataPacket>({ slug, table: "staff", columns: "full_name", where: "id = ?", params: [staffId], limit: 1 });
    return String(staff[0]?.full_name ?? "");
  } catch {
    return "";
  }
}

async function resolveClientForAppointment(slug: string, clientName: string, locationId: number | null): Promise<{ id: number; name: string }> {
  const normalized = normalizeName(clientName, "Cliente");
  const existing = await tenantSelect<RowDataPacket>({ slug, table: "clients", columns: "id,full_name", where: "LOWER(full_name) = ?", params: [normalized.toLowerCase()], limit: 1 });
  if (existing[0]) return { id: Number(existing[0].id), name: String(existing[0].full_name) };
  const created = await createDbClient({ name: normalized, locationId: locationId ?? 0 }, slug);
  return { id: created.id, name: created.name };
}

async function resolveServiceForAppointment(slug: string, serviceName: string): Promise<RowDataPacket> {
  const normalized = serviceName.trim();
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "services",
    where: normalized ? "LOWER(name) = ?" : "COALESCE(is_active, 1) = 1",
    params: normalized ? [normalized.toLowerCase()] : [],
    orderBy: "sort_order ASC, id ASC",
    limit: 1,
  });
  if (!rows[0]) throw new Error("Servizio non trovato.");
  return rows[0];
}

async function resolveStaffForAppointment(slug: string, staffName: string): Promise<RowDataPacket | null> {
  const normalized = staffName.trim();
  if (!normalized) return null;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "staff",
    columns: "id,full_name",
    where: "LOWER(full_name) = ? AND COALESCE(is_active, 1) = 1",
    params: [normalized.toLowerCase()],
    limit: 1,
  });
  return rows[0] ?? null;
}

async function insertAppointmentService(slug: string, appointmentId: number, service: RowDataPacket): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "appointment_services"), {
      appointment_id: appointmentId,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      qty: 1,
      price: Number(service.price ?? 0),
      list_price: Number(service.price ?? 0),
      duration_min: Number(service.duration_min ?? 30),
    });
  } catch {
    // compatibility: older installs may not have the snapshot table
  }
}

async function insertAppointmentStaff(slug: string, appointmentId: number, staffId: number): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "appointment_staff"), { appointment_id: appointmentId, staff_id: staffId });
  } catch {
    // compatibility
  }
}

async function insertAppointmentLocation(slug: string, appointmentId: number, locationId: number): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "appointment_locations"), { appointment_id: appointmentId, location_id: locationId });
  } catch {
    // compatibility
  }
}

// Insert one appointment_segments row. `position` is the 0-based sequential index
// (legacy rebuild_segments_for_appointment uses a 0-based cursor); `cabinId`, when
// provided, overrides the service's own cabin (per-service cabin map / explicit
// drawer cabin). Both default to the single-service behaviour (position 0, service
// cabin) for backward compatibility.
async function insertAppointmentSegment(
  slug: string,
  appointmentId: number,
  service: RowDataPacket,
  staffId: number | null,
  startsAt: string,
  endsAt: string,
  durationMinutes: number,
  position = 0,
  cabinId?: number | null,
): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "appointment_segments"), {
      appointment_id: appointmentId,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      staff_id: staffId ?? 0,
      position,
      starts_at: startsAt,
      ends_at: endsAt,
      duration_minutes: durationMinutes,
      cabin_id: cabinId === undefined ? (service.cabin_id ?? null) : cabinId,
    });
  } catch {
    // compatibility
  }
}

async function assertDbAppointmentHold({
  slug,
  token,
  ownerKey,
  startsAt,
  serviceId,
  staffId,
  locationId,
}: {
  slug: string;
  token: string;
  ownerKey: string;
  startsAt: string;
  serviceId: number;
  staffId: number | null;
  locationId: number | null;
}): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    where: "token = ? AND owner_key = ? AND status = 'active' AND expires_at > NOW()",
    params: [token, ownerKey],
    limit: 1,
  });
  const hold = rows[0];
  if (!hold) throw new Error("Hold appuntamento scaduto o non valido.");
  if (sqlDateTimePrefix(hold.starts_at) !== startsAt.slice(0, 16)) throw new Error("Hold non coerente con orario selezionato.");

  const heldServices = parseDbNumberArray(hold.service_ids_json);
  if (serviceId > 0 && heldServices.length > 0 && !heldServices.includes(serviceId)) throw new Error("Hold non coerente con servizio selezionato.");

  const heldStaff = parseDbNumberArray(hold.staff_ids_json);
  if (staffId && heldStaff.length > 0 && !heldStaff.includes(staffId)) throw new Error("Hold non coerente con operatore selezionato.");

  const heldLocationId = hold.location_id === null || hold.location_id === undefined ? null : Number(hold.location_id);
  if (locationId && heldLocationId && heldLocationId !== locationId) throw new Error("Hold non coerente con sede selezionata.");
}

async function markDbAppointmentHoldConverted(slug: string, token: string, ownerKey: string, appointmentId: number): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    columns: "id",
    where: "token = ? AND owner_key = ?",
    params: [token, ownerKey],
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  const id = Number(rows[0]?.id ?? 0);
  if (id > 0) await tenantUpdate({ slug, table: "appointment_holds", id, values: { status: "converted", appointment_id: appointmentId } });
}

async function getSingleService(slug: string, id: number): Promise<ManagedService> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "services", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Servizio non trovato.");
  return mapService(rows[0]);
}

async function getSingleProduct(slug: string, id: number): Promise<ManagedProduct> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "products", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Prodotto non trovato.");
  return mapProduct(rows[0]);
}

function mapClient(row: RowDataPacket): ManagedClient {
  const value = Number(row.credit_balance ?? 0);
  return {
    id: Number(row.id ?? 0),
    name: String(row.full_name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Cliente")),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    locationId: Number(row.location_id ?? 0),
    tags: [],
    archived: Number(row.is_blocked ?? 0) === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.created_at),
    lastVisit: row.registration_date ? String(row.registration_date).slice(0, 10) : "-",
    value: `${roundMoney(value)} euro`,
    next: "-",
    note: String(row.notes ?? ""),
  };
}

function mapService(row: RowDataPacket): ManagedService {
  const active = Number(row.is_active ?? 1) === 1;
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Servizio"),
    duration: `${Number(row.duration_min ?? 0)} min`,
    price: `${roundMoney(Number(row.price ?? 0))} euro`,
    category: row.category_id ? `Categoria #${row.category_id}` : "Servizi",
    demand: active ? "Attivo" : "Disattivo",
    color: "#007c72",
    description: "",
    locationIds: [],
    active,
    bookingEnabled: Number(row.booking_enabled ?? 1) === 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapProduct(row: RowDataPacket): ManagedProduct {
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Prodotto"),
    category: row.category_id ? `Categoria #${row.category_id}` : "Prodotti",
    brand: String(row.brand ?? ""),
    price: `${roundMoney(Number(row.price ?? 0))} euro`,
    image: "/window.svg",
    sku: String(row.sku ?? row.internal_code ?? ""),
    stock: Number(row.stock ?? 0),
    minStock: Number(row.min_stock ?? 0),
    locationId: 0,
    publicVisible: Number(row.sell_online ?? 0) === 1,
    movements: [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.created_at),
  };
}

async function tryInsertStockMove({
  slug,
  productId,
  type,
  quantity,
  reason,
}: {
  slug: string;
  productId: number;
  type: StockMovement["type"];
  quantity: number;
  reason: string;
}): Promise<void> {
  try {
    const table = await tenantTable(slug, "stock_moves");
    const values: Record<string, unknown> = {
      product_id: productId,
      type,
      quantity,
      reason: reason || "Movimento stock",
      created_at: new Date(),
    };
    if (await columnExists(table.name, "movement_type")) {
      values.movement_type = values.type;
      delete values.type;
    }
    await tenantInsert(table, values);
  } catch {
    // Stock moves are best-effort because older installs may not have this table yet.
  }
}

function normalizeName(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function slugSegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sede";
}

function parseDbNumberArray(value: unknown): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    // fallback below
  }
  return String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function activeWindow(startsAt: string, endsAt: string): boolean {
  const today = todayIso();
  return (!startsAt || startsAt <= today) && (!endsAt || endsAt >= today);
}

function discountValue(type: CouponType, value: number, subtotal: number): number {
  const amount = type === "percent" ? subtotal * (value / 100) : value;
  return roundMoney(Math.max(0, Math.min(subtotal, amount)));
}

function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function parseDuration(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMoney(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateIsoLocal(date);
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sqlDateTimePrefix(value: unknown): string {
  if (value instanceof Date) {
    return `${dateIsoLocal(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return String(value ?? "").slice(0, 16);
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeTime(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "09:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function addMinutesSqlDate(sqlDate: string, minutes: number): string {
  const date = new Date(sqlDate.replace(" ", "T"));
  date.setMinutes(date.getMinutes() + minutes);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + " " + [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    "00",
  ].join(":");
}

function dateIsoLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeLocal(date: Date): string {
  return [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")].join(":");
}

function uiStatus(status: string): AppointmentStatus {
  if (status === "done") return "Completato";
  if (status === "pending") return "In attesa";
  return "Confermato";
}

function phpStatus(status: AppointmentStatus | string): string {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "completato" || normalized === "done" || normalized === "completed") return "done";
  if (normalized === "in attesa" || normalized === "pending" || normalized === "waiting") return "pending";
  if (normalized === "canceled" || normalized === "cancelled" || normalized === "annullato") return "canceled";
  if (normalized === "no_show" || normalized === "no show") return "no_show";
  return "scheduled";
}

// ===================== QUICK-BOOKING CLIENT CONTEXT =====================
// Faithful port of `api_clients.php` action=history (summary) + action=residuals
// (summary=1), the two payloads the quick-booking drawer's CLIENT HISTORY and
// RESIDUALS panels consume (assets/js/app.js qbLoadClientHistory /
// qbLoadClientResiduals). Both are tenant-scoped via `tenantSelect`, and every
// residual block is guarded so a missing table/column simply yields count 0
// (mirrors the legacy `try/catch` + `table_exists()`/`column_exists()` checks).

export type QuickBookClientHistorySummary = {
  total: number;
  last_visit: string | null;
  next_visit: string | null;
  sales_total: number;
};

export type QuickBookClientResidualsSummary = {
  services_count: number;
  gifts_count: number;
  giftboxes_count: number;
  giftcards_count: number;
  packages_count: number;
  credit_count: number;
  credit_available: number;
  total: number;
};

// One available (redeemable) package for the quick-booking drawer's per-service
// "Usa pacchetto" control. `service_ids` are the services this package COVERS and
// still has sessions for (the per-service `client_package_services` rows with
// sessions_remaining > 0, or the legacy single `client_packages.service_id`).
// `serviceItemIds` maps a covered service_id -> its `client_package_services.id`
// (the legacy `client_package_service_id`) so the redeem can pin the exact row;
// absent for legacy single-service packages (the package-level pool is used).
export type QuickBookClientPackage = {
  id: number;
  name: string;
  sessions_remaining: number;
  expires_at: string | null;
  service_ids: number[];
  serviceItemIds: Record<number, number>;
};

// One available (redeemable) prepaid-service balance for the per-service "Usa
// prepagato" control (port of api_clients.php action=residuals prepaid block +
// ClientPrepaidServices::listAvailableForClient; returned by quickbook_client_context).
// A prepaid is tied to ONE service directly (`service_id`), so coverage is a single
// service — no separate coverage table. `remaining_qty` is the consumable balance.
export type QuickBookClientPrepaid = {
  id: number;
  service_id: number;
  name: string;
  remaining_qty: number;
};

// One available (redeemable) GiftCard for the APPOINTMENT-LEVEL "GiftCard" control
// (port of api_clients.php action=residuals giftcard block; returned by
// quickbook_client_context). A GiftCard is MONETARY (a spendable `balance`, not a
// per-service unit) and applies to the WHOLE appointment — one giftcard per
// appointment, an amount. `balance` is the consumable monetary balance.
export type QuickBookClientGiftcard = {
  id: number;
  code: string;
  balance: number;
};

// One available (redeemable) GiftBox ITEM for the per-service "Usa GiftBox" control
// (returned by quickbook_client_context). GiftBox is per-service + ITEM-based (like a
// package): each entry is a single item from an issued, non-expired instance that still
// has a residual unit and covers exactly `service_id`. `instance_id` + `giftbox_item_id`
// (the giftbox_instance_items.giftbox_item_id value) pin the redeem; `name` is the item /
// service label for the option. The drawer offers it on the service it covers.
export type QuickBookClientGiftbox = {
  instance_id: number;
  giftbox_item_id: number;
  service_id: number;
  name: string;
};

// One available (redeemable) GIFT (omaggio) SERVICE REWARD for the per-service "Usa
// Omaggio" control (returned by quickbook_client_context). A gift INSTANCE holds REWARD
// ITEMS (gifts.reward_items_json, an array); a SERVICE reward is one whose type='service'
// with a positive service_id. Each entry here is a single still-available service reward
// (qty_remaining > 0) from an available (state='disponibile', active, non-expired) instance
// owned by the client. `instance_id` + `reward_item_index` (the reward's ARRAY INDEX in the
// gift's reward_items_json) pin the redeem; `service_id` is the covered service; `name` is
// the service label for the option. The drawer offers it on the service it covers.
export type QuickBookClientGift = {
  instance_id: number;
  reward_item_index: number;
  service_id: number;
  name: string;
};

export type QuickBookClientContext = {
  history: QuickBookClientHistorySummary;
  residuals: QuickBookClientResidualsSummary;
  packages: QuickBookClientPackage[];
  prepaids: QuickBookClientPrepaid[];
  giftcards: QuickBookClientGiftcard[];
  giftboxes: QuickBookClientGiftbox[];
  gifts: QuickBookClientGift[];
};

// History summary — port of api_clients.php lines ~3926-3958:
//   total      = COUNT(*) of ALL appointments for the client (no status filter)
//   last_visit = MAX(starts_at) where starts_at < NOW() (any status)
//   next_visit = MIN(starts_at) where starts_at >= NOW() AND status IN ('pending','scheduled')
//   sales_total= SUM(total) of the client's sales, excluding cancelled when a
//                sales.status column exists (legacy $salesWhereStatus).
async function quickBookClientHistorySummary(slug: string, clientId: number): Promise<QuickBookClientHistorySummary> {
  const out: QuickBookClientHistorySummary = { total: 0, last_visit: null, next_visit: null, sales_total: 0 };

  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointments",
      columns:
        "COUNT(*) AS total, " +
        "MAX(CASE WHEN starts_at < NOW() THEN starts_at ELSE NULL END) AS last_visit, " +
        "MIN(CASE WHEN starts_at >= NOW() AND status IN ('pending','scheduled') THEN starts_at ELSE NULL END) AS next_visit",
      where: "client_id = ?",
      params: [clientId],
    });
    const row = rows[0] ?? {};
    out.total = Number(row.total ?? 0) || 0;
    out.last_visit = row.last_visit ? String(row.last_visit) : null;
    out.next_visit = row.next_visit ? String(row.next_visit) : null;
  } catch {
    // tolerate missing appointments table
  }

  try {
    const salesTable = await tenantTable(slug, "sales");
    const hasStatus = await columnExists(salesTable.name, "status");
    const where = hasStatus
      ? "client_id = ? AND (status IS NULL OR status NOT IN ('cancelled','canceled'))"
      : "client_id = ?";
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "sales",
      columns: "COALESCE(SUM(total), 0) AS t",
      where,
      params: [clientId],
    });
    out.sales_total = roundMoney(Number(rows[0]?.t ?? 0));
  } catch {
    out.sales_total = 0;
  }

  return out;
}

// Residuals summary — port of api_clients.php lines ~1800-1973 (the summary=1
// branch). Each ACTIVE/unconsumed item type is counted independently and any
// missing table/column degrades to 0. `locationId` only narrows the count when
// > 0 (the legacy applies the per-location service-allow filter only then; the
// Next manage app has no ported per-location service map, so the location is
// accepted but does not further filter — documented as a TODO).
async function quickBookClientResidualsSummary(
  slug: string,
  clientId: number,
): Promise<QuickBookClientResidualsSummary> {
  const out: QuickBookClientResidualsSummary = {
    services_count: 0,
    gifts_count: 0,
    giftboxes_count: 0,
    giftcards_count: 0,
    packages_count: 0,
    credit_count: 0,
    credit_available: 0,
    total: 0,
  };

  // Credito cliente — clients.credit_balance (legacy api_clients_credit_residual_data:
  // credit_count = 1 when available > 0, credit_available = the balance).
  try {
    const { credit } = await dbWalletBalance(clientId, slug);
    out.credit_available = roundMoney(Math.max(0, credit));
    out.credit_count = out.credit_available > 0.00001 ? 1 : 0;
  } catch {
    out.credit_available = 0;
    out.credit_count = 0;
  }

  // Servizi prepagati — ClientPrepaidServices::listAvailableForClient:
  //   client_prepaid_services WHERE client_id=? AND status='active' AND remaining_qty > 0
  //   (+ expires_at IS NULL OR expires_at >= CURDATE() when the column exists).
  try {
    const prepaidTable = await tenantTable(slug, "client_prepaid_services");
    const hasExpiry = await columnExists(prepaidTable.name, "expires_at");
    const where = hasExpiry
      ? "client_id = ? AND status = 'active' AND remaining_qty > 0 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)"
      : "client_id = ? AND status = 'active' AND remaining_qty > 0";
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "client_prepaid_services",
      columns: "COUNT(*) AS c",
      where,
      params: [clientId],
    });
    out.services_count = Math.max(0, Number(rows[0]?.c ?? 0) || 0);
  } catch {
    out.services_count = 0;
  }

  // GiftCard — legacy giftcards WHERE (recipient_client_id | client_id)
  //   AND status='active' AND balance > 0 AND (expires_at IS NULL OR expires_at >= CURDATE()).
  try {
    const giftcardTable = await tenantTable(slug, "giftcards");
    const hasRecipient = await columnExists(giftcardTable.name, "recipient_client_id");
    const hasExpiry = await columnExists(giftcardTable.name, "expires_at");
    const target = hasRecipient ? "recipient_client_id = ?" : "client_id = ?";
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)" : "";
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "giftcards",
      columns: "COUNT(*) AS c",
      where: `${target} AND status = 'active' AND balance > 0${expiry}`,
      params: [clientId],
    });
    out.giftcards_count = Math.max(0, Number(rows[0]?.c ?? 0) || 0);
  } catch {
    out.giftcards_count = 0;
  }

  // Pacchetti — legacy client_packages WHERE client_id=? AND status='active'
  //   AND sessions_remaining > 0 AND (expires_at IS NULL OR expires_at >= CURDATE()).
  try {
    const packageTable = await tenantTable(slug, "client_packages");
    const hasExpiry = await columnExists(packageTable.name, "expires_at");
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)" : "";
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "client_packages",
      columns: "COUNT(*) AS c",
      where: `client_id = ? AND status = 'active' AND sessions_remaining > 0${expiry}`,
      params: [clientId],
    });
    out.packages_count = Math.max(0, Number(rows[0]?.c ?? 0) || 0);
  } catch {
    out.packages_count = 0;
  }

  // GiftBox — legacy counts issued, not-expired instances whose
  //   (total_qty - redeemed_qty) > 0. We reuse the same residual maths the
  //   Next giftbox mapper uses (giftbox_instance_items qty - redemptions) per
  //   instance, counting instances with a positive remainder. Tolerates the
  //   giftbox tables being absent (count 0).
  try {
    const hasInstances = await tableExists((await tenantTable(slug, "giftbox_instances")).name);
    if (hasInstances) {
      const instanceTable = await tenantTable(slug, "giftbox_instances");
      const hasRecipient = await columnExists(instanceTable.name, "recipient_client_id");
      const hasExpiry = await columnExists(instanceTable.name, "expires_at");
      const target = hasRecipient
        ? "(recipient_client_id = ? OR (recipient_client_id IS NULL AND client_id = ?))"
        : "client_id = ?";
      const params = hasRecipient ? [clientId, clientId] : [clientId];
      const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= NOW())" : "";
      const instances = await tenantSelect<RowDataPacket>({
        slug,
        table: "giftbox_instances",
        columns: "id",
        where: `${target} AND status = 'issued'${expiry}`,
        params,
      });
      let count = 0;
      for (const inst of instances) {
        const instanceId = Number(inst.id ?? 0);
        if (instanceId <= 0) continue;
        try {
          const items = await tenantSelect<RowDataPacket>({
            slug,
            table: "giftbox_instance_items",
            columns: "qty",
            where: "instance_id = ?",
            params: [instanceId],
          });
          const totalQty = items.reduce((sum, item) => sum + Math.max(0, Number(item.qty ?? 0)), 0);
          const redeemed = await giftBoxRedeemedUnits(slug, instanceId);
          if (totalQty - redeemed > 0) count += 1;
        } catch {
          // tolerate giftbox item/redemption tables being absent
        }
      }
      out.giftboxes_count = Math.max(0, count);
    }
  } catch {
    out.giftboxes_count = 0;
  }

  // Omaggi (gifts) — the legacy sums qty_remaining of SERVICE reward items
  //   (Gifts::countAvailableServiceRewardsForClient). We now port the reward-item
  //   maths via quickBookClientGifts (the same available-instance + per-reward
  //   residual rule the drawer's "Usa Omaggio" control uses), so the badge count
  //   matches the redeemable rewards exactly (one count per available service reward).
  try {
    const gifts = await quickBookClientGifts(slug, clientId);
    out.gifts_count = Math.max(0, gifts.length);
  } catch {
    out.gifts_count = 0;
  }

  out.total =
    out.services_count +
    out.gifts_count +
    out.giftboxes_count +
    out.giftcards_count +
    out.packages_count +
    out.credit_count;
  return out;
}

// Combined quick-booking client context (history + residuals summaries),
// tenant-scoped + session-gated by the API route. Mirrors the two legacy
// endpoints the drawer calls when a client is selected.
export async function quickBookClientContext({
  slug,
  clientId,
}: {
  slug: string;
  clientId: number;
  // location_id is accepted by the route for parity with the legacy residuals
  // endpoint, but the Next manage app has no ported per-location service map, so
  // it does not further narrow the counts (TODO: port the per-location filter).
  locationId?: number;
}): Promise<QuickBookClientContext> {
  if (clientId <= 0) throw new Error("client_id mancante");
  const [history, residuals, packages, prepaids, giftcards, giftboxes, gifts] = await Promise.all([
    quickBookClientHistorySummary(slug, clientId),
    quickBookClientResidualsSummary(slug, clientId),
    quickBookClientPackages(slug, clientId),
    quickBookClientPrepaids(slug, clientId),
    quickBookClientGiftcards(slug, clientId),
    quickBookClientGiftboxes(slug, clientId),
    quickBookClientGifts(slug, clientId),
  ]);
  return { history, residuals, packages, prepaids, giftcards, giftboxes, gifts };
}

// Available (redeemable) packages for a client, with the services each package
// covers — drives the drawer's per-service "Usa pacchetto" control. Port of the
// api_clients.php action=residuals PACKAGE block (the "available" filter +
// per-service `client_package_services` breakdown), narrowed to what the redeem
// UI needs. Tenant-scoped via `tenantSelect`; every read is guarded so a missing
// table/column degrades to an empty list (mirrors the legacy table_exists guards).
//
// "Available" mirrors the legacy WHERE exactly: status='active' AND
// sessions_remaining > 0 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE),
// client-scoped. Coverage is the per-service `client_package_services` rows with
// their own sessions_remaining > 0; when a package has no such rows we fall back
// to the legacy single `client_packages.service_id` (package-level pool).
async function quickBookClientPackages(slug: string, clientId: number): Promise<QuickBookClientPackage[]> {
  if (clientId <= 0) return [];
  let packageRows: RowDataPacket[] = [];
  try {
    const packageTable = await tenantTable(slug, "client_packages");
    const hasExpiry = await columnExists(packageTable.name, "expires_at");
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)" : "";
    packageRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "client_packages",
      columns: "id, package_name, sessions_remaining, service_id, expires_at",
      where: `client_id = ? AND status = 'active' AND sessions_remaining > 0${expiry}`,
      params: [clientId],
      orderBy: "(expires_at IS NULL) DESC, expires_at ASC, id DESC",
      limit: 50,
    });
  } catch {
    return [];
  }
  if (packageRows.length === 0) return [];

  // Per-service coverage rows (own sessions_remaining > 0) for all packages at once.
  const ids = packageRows.map((row) => Number(row.id ?? 0)).filter((id) => id > 0);
  const coverageByPackage = new Map<number, Array<{ serviceId: number; itemId: number }>>();
  if (ids.length > 0) {
    try {
      const placeholders = ids.map(() => "?").join(",");
      const coverageRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "client_package_services",
        columns: "id, client_package_id, service_id, sessions_remaining",
        where: `client_package_id IN (${placeholders}) AND sessions_remaining > 0`,
        params: ids,
        orderBy: "client_package_id ASC, sort_order ASC, id ASC",
      });
      for (const row of coverageRows) {
        const packageId = Number(row.client_package_id ?? 0);
        const serviceId = Number(row.service_id ?? 0);
        const itemId = Number(row.id ?? 0);
        if (packageId <= 0 || serviceId <= 0) continue;
        const list = coverageByPackage.get(packageId) ?? [];
        list.push({ serviceId, itemId });
        coverageByPackage.set(packageId, list);
      }
    } catch {
      // client_package_services may be absent (legacy single-service packages only).
    }
  }

  const out: QuickBookClientPackage[] = [];
  for (const row of packageRows) {
    const id = Number(row.id ?? 0);
    if (id <= 0) continue;
    const coverage = coverageByPackage.get(id) ?? [];
    const serviceIds: number[] = [];
    const serviceItemIds: Record<number, number> = {};
    if (coverage.length > 0) {
      for (const { serviceId, itemId } of coverage) {
        if (!serviceIds.includes(serviceId)) serviceIds.push(serviceId);
        // First (lowest sort_order) covering row wins for the pin id.
        if (serviceItemIds[serviceId] === undefined) serviceItemIds[serviceId] = itemId;
      }
    } else {
      // Legacy single-service package: cover only client_packages.service_id.
      const legacyServiceId = Number(row.service_id ?? 0);
      if (legacyServiceId > 0) serviceIds.push(legacyServiceId);
    }
    if (serviceIds.length === 0) continue; // nothing this package can cover -> not offerable
    out.push({
      id,
      name: String(row.package_name ?? "Pacchetto"),
      sessions_remaining: Math.max(0, Number(row.sessions_remaining ?? 0)),
      expires_at: row.expires_at ? String(row.expires_at).slice(0, 10) : null,
      service_ids: serviceIds,
      serviceItemIds,
    });
  }
  return out;
}

// Available (redeemable) prepaid-service balances for a client — drives the drawer's
// per-service "Usa prepagato" control. Port of api_clients.php action=residuals
// PREPAID block + ClientPrepaidServices::listAvailableForClient. Tenant-scoped via
// `tenantSelect`; every read is guarded so a missing table/column degrades to an
// empty list. "Available" mirrors the legacy WHERE exactly: status='active' AND
// remaining_qty > 0 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE),
// client-scoped. A prepaid is tied to ONE service directly (service_id), so each
// returned entry covers exactly that one service (no per-service coverage table).
async function quickBookClientPrepaids(slug: string, clientId: number): Promise<QuickBookClientPrepaid[]> {
  if (clientId <= 0) return [];
  let prepaidRows: RowDataPacket[] = [];
  try {
    const prepaidTable = await tenantTable(slug, "client_prepaid_services");
    const hasExpiry = await columnExists(prepaidTable.name, "expires_at");
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)" : "";
    prepaidRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "client_prepaid_services",
      columns: "id, service_id, service_name, remaining_qty",
      where: `client_id = ? AND status = 'active' AND remaining_qty > 0${expiry}`,
      params: [clientId],
      orderBy: "(expires_at IS NULL) DESC, expires_at ASC, id DESC",
      limit: 100,
    });
  } catch {
    return [];
  }
  if (prepaidRows.length === 0) return [];

  const out: QuickBookClientPrepaid[] = [];
  for (const row of prepaidRows) {
    const id = Number(row.id ?? 0);
    const serviceId = Number(row.service_id ?? 0);
    if (id <= 0 || serviceId <= 0) continue; // a prepaid with no service can cover nothing
    out.push({
      id,
      service_id: serviceId,
      name: String(row.service_name ?? "Prepagato"),
      remaining_qty: Math.max(0, Number(row.remaining_qty ?? 0)),
    });
  }
  return out;
}

// Available (redeemable) GiftCards for a client — drives the drawer's APPOINTMENT-LEVEL
// "GiftCard" control. Port of api_clients.php action=residuals GIFTCARD block (the same
// availability rule the residuals summary counts at quickBookClientResidualsSummary).
// Tenant-scoped via `tenantSelect`; every read is guarded so a missing table/column
// degrades to an empty list. "Available" mirrors the legacy WHERE exactly:
//   (recipient_client_id | client_id) = ? AND status='active' AND balance > 0
//   AND (expires_at IS NULL OR expires_at >= CURRENT_DATE),
// client-scoped. A GiftCard is MONETARY (a spendable `balance`) and applies to the
// WHOLE appointment (one per appointment, an amount) — NOT per-service like package/
// prepaid. The recipient_client_id column (when present) is the target client; older
// installs fall back to client_id (the same column the residuals block chooses).
async function quickBookClientGiftcards(slug: string, clientId: number): Promise<QuickBookClientGiftcard[]> {
  if (clientId <= 0) return [];
  let giftcardRows: RowDataPacket[] = [];
  try {
    const giftcardTable = await tenantTable(slug, "giftcards");
    const hasRecipient = await columnExists(giftcardTable.name, "recipient_client_id");
    const hasExpiry = await columnExists(giftcardTable.name, "expires_at");
    const target = hasRecipient ? "recipient_client_id = ?" : "client_id = ?";
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)" : "";
    giftcardRows = await tenantSelect<RowDataPacket>({
      slug,
      table: "giftcards",
      columns: "id, code, balance",
      where: `${target} AND status = 'active' AND balance > 0${expiry}`,
      params: [clientId],
      orderBy: "(expires_at IS NULL) DESC, expires_at ASC, id DESC",
      limit: 50,
    });
  } catch {
    return [];
  }
  if (giftcardRows.length === 0) return [];

  const out: QuickBookClientGiftcard[] = [];
  for (const row of giftcardRows) {
    const id = Number(row.id ?? 0);
    const balance = roundMoney(Math.max(0, Number(row.balance ?? 0)));
    if (id <= 0 || balance <= 0) continue; // a giftcard with no balance covers nothing
    out.push({
      id,
      code: String(row.code ?? ""),
      balance,
    });
  }
  return out;
}

// Available (redeemable) GiftBox ITEMS for a client — drives the drawer's per-service
// "Usa GiftBox" control. GiftBox is per-service + ITEM-based (like a package): a single
// giftbox item covers ONE service, consuming one unit. This adapts the residuals giftbox
// block (quickBookClientResidualsSummary), but exposes one entry PER ITEM (with its
// service_id) so the drawer can offer a giftbox on the service it covers. Tenant-scoped
// via tenantSelect; every read is guarded so a missing table/column degrades to an empty
// list. "Available" mirrors the legacy rule exactly: the instance is status='issued' and
// not expired and belongs to the client (recipient_client_id when set, else client_id),
// and the item's residual (giftbox_instance_items.qty MINUS giftBoxItemRedeemedUnits for
// that item) is > 0. Only SERVICE items (item_type='service' with a positive service_id)
// are offerable. Mirrors qb_giftbox_item_remaining + the residuals giftbox computation.
async function quickBookClientGiftboxes(slug: string, clientId: number): Promise<QuickBookClientGiftbox[]> {
  if (clientId <= 0) return [];
  let instances: RowDataPacket[] = [];
  try {
    if (!(await tableExists((await tenantTable(slug, "giftbox_instances")).name))) return [];
    const instanceTable = await tenantTable(slug, "giftbox_instances");
    const hasRecipient = await columnExists(instanceTable.name, "recipient_client_id");
    const hasExpiry = await columnExists(instanceTable.name, "expires_at");
    const target = hasRecipient
      ? "(recipient_client_id = ? OR (recipient_client_id IS NULL AND client_id = ?))"
      : "client_id = ?";
    const params = hasRecipient ? [clientId, clientId] : [clientId];
    const expiry = hasExpiry ? " AND (expires_at IS NULL OR expires_at >= NOW())" : "";
    instances = await tenantSelect<RowDataPacket>({
      slug,
      table: "giftbox_instances",
      columns: "id",
      where: `${target} AND status = 'issued'${expiry}`,
      params,
      orderBy: "(expires_at IS NULL) DESC, expires_at ASC, id DESC",
      limit: 100,
    });
  } catch {
    return [];
  }
  if (instances.length === 0) return [];

  const out: QuickBookClientGiftbox[] = [];
  for (const inst of instances) {
    const instanceId = Number(inst.id ?? 0);
    if (instanceId <= 0) continue;
    try {
      const items = await tenantSelect<RowDataPacket>({
        slug,
        table: "giftbox_instance_items",
        columns: "giftbox_item_id, item_type, service_id, qty, custom_label",
        where: "instance_id = ?",
        params: [instanceId],
        orderBy: "sort_order ASC, giftbox_item_id ASC",
      });
      for (const item of items) {
        const itemType = String(item.item_type ?? "service");
        if (itemType !== "service") continue; // only service items can cover a service
        const giftboxItemId = Number(item.giftbox_item_id ?? 0);
        const serviceId = Number(item.service_id ?? 0);
        if (giftboxItemId <= 0 || serviceId <= 0) continue;
        const totalQty = Math.max(0, Number(item.qty ?? 0));
        const redeemed = await giftBoxItemRedeemedUnits(slug, instanceId, giftboxItemId);
        if (totalQty - redeemed <= 0) continue; // exhausted -> not offerable
        const label = String(item.custom_label ?? "") || (await serviceNameById(slug, serviceId, "Servizio"));
        out.push({ instance_id: instanceId, giftbox_item_id: giftboxItemId, service_id: serviceId, name: label });
      }
    } catch {
      // tolerate giftbox item/redemption tables being absent for this instance
    }
  }
  return out;
}

// One normalized GIFT reward item (parity with Gifts::normalizeRewardItems): a reward
// has a `type` ('service' | 'product' | 'custom'), a positive `qty` (>= 1), and — for a
// SERVICE reward — a `service_id`. The reward's identity in a redeem is its ARRAY INDEX
// (`reward_item_index`) in the gift's reward_items_json, NOT a surrogate id. Only service
// rewards are redeemable into a booked service here (a free service is a reward).
type GiftRewardItem = { type: string; serviceId: number; qty: number };

// Parse a gift's reward_items_json (a JSON array on the `gifts` row) into normalized
// reward items, preserving ARRAY ORDER (the index is the reward_item_index). Mirrors
// Gifts::normalizeRewardItems: each item carries a type (defaulting to 'custom') and a
// qty (>= 1, defaulting to 1); a service reward additionally needs a positive service_id
// (service_id | reward_service_id). Non-array / unparseable JSON -> empty list. IMPORTANT:
// items are NOT filtered here (so a non-service reward still consumes an index) — the
// caller filters to service rewards by `type === 'service' && serviceId > 0`.
function parseGiftRewardItems(rawJson: unknown): GiftRewardItem[] {
  if (typeof rawJson !== "string") return [];
  const trimmed = rawJson.trim();
  if (!trimmed) return [];
  let decoded: unknown;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(decoded)) return [];
  const out: GiftRewardItem[] = [];
  for (const raw of decoded) {
    if (!raw || typeof raw !== "object") {
      out.push({ type: "custom", serviceId: 0, qty: 1 }); // keep the index stable
      continue;
    }
    const entry = raw as Record<string, unknown>;
    let type = String(entry.type ?? entry.reward_type ?? "custom").trim().toLowerCase();
    if (type !== "service" && type !== "product" && type !== "custom") type = "custom";
    let qty = Number.parseInt(String(entry.qty ?? entry.reward_qty ?? entry.quantity ?? 1), 10);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;
    if (qty > 1000000) qty = 1000000;
    const serviceId =
      type === "service" ? Number.parseInt(String(entry.service_id ?? entry.reward_service_id ?? 0), 10) || 0 : 0;
    out.push({ type, serviceId, qty });
  }
  return out;
}

// Units already REDEEMED for a SINGLE gift reward, keyed by the legacy composite
// (reward_item_index + service_id) — exactly Gifts::redeemedRewardQtyByInstance's key.
// The authoritative consumed count is SUM(qty) of appointment_gift_items rows for this
// instance whose redeemed_at IS NOT NULL and that target this reward_item_index +
// service_id. Recording a redeem (an appointment_gift_items row with redeemed_at set and
// qty 1 for that index/service) therefore makes this reflect the consumption, so a reward
// can never be double-redeemed within or across saves. Tolerates the tracking table being
// absent (-> 0). (The legacy also reads gift_transactions; the Next port does not write
// those, so appointment_gift_items is the single source of truth here.)
async function giftRewardRedeemedQty(
  slug: string,
  instanceId: number,
  rewardItemIndex: number,
  serviceId: number,
): Promise<number> {
  if (instanceId <= 0) return 0;
  try {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "appointment_gift_items",
      columns: "COALESCE(SUM(qty), 0) AS c",
      where: "instance_id = ? AND reward_item_index = ? AND service_id = ? AND redeemed_at IS NOT NULL",
      params: [instanceId, rewardItemIndex, serviceId],
    });
    return Math.max(0, Number(rows[0]?.c ?? 0) || 0);
  } catch {
    return 0;
  }
}

// Available (redeemable) GIFT (omaggio) SERVICE REWARDS for a client — drives the drawer's
// per-service "Usa Omaggio" control. A gift INSTANCE holds REWARD ITEMS (the reward set
// lives in gifts.reward_items_json, joined from the instance's gift_id); a SERVICE reward
// (type='service', positive service_id) can be applied to a booked service (zero-charge).
// This exposes one entry PER still-available service reward (qty_remaining > 0) so the
// drawer can offer it on the service it covers. Tenant-scoped via tenantSelect; every read
// is guarded so a missing table/column degrades to an empty list.
//
// "Available" mirrors Gifts::clientAvailableInstances + listAvailableServiceRewardsForClient
// exactly: the instance belongs to the client (gift_instances.client_id), is state =
// 'disponibile' (the legacy normalizes derived state to this), (is_active = 1 OR state IN
// ('disponibile','riscattato')), and not expired (expires_at IS NULL OR by calendar day);
// then for each reward item of type 'service' with a positive service_id, qty_remaining =
// reward qty MINUS giftRewardRedeemedQty(index, service_id) must be > 0. `reward_item_index`
// is the reward's ARRAY INDEX in reward_items_json (parity with the legacy index).
async function quickBookClientGifts(slug: string, clientId: number): Promise<QuickBookClientGift[]> {
  if (clientId <= 0) return [];
  let instances: RowDataPacket[] = [];
  try {
    const giftTable = await tenantTable(slug, "gift_instances");
    if (!(await tableExists(giftTable.name))) return [];
    const hasState = await columnExists(giftTable.name, "state");
    const hasActive = await columnExists(giftTable.name, "is_active");
    const hasExpiry = await columnExists(giftTable.name, "expires_at");
    const clauses = ["client_id = ?"];
    if (hasState) clauses.push("state = 'disponibile'");
    if (hasActive && hasState) clauses.push("(is_active = 1 OR state IN ('disponibile','riscattato'))");
    else if (hasActive) clauses.push("is_active = 1");
    if (hasExpiry) clauses.push("(expires_at IS NULL OR expires_at >= CURRENT_DATE)");
    instances = await tenantSelect<RowDataPacket>({
      slug,
      table: "gift_instances",
      columns: "id, gift_id",
      where: clauses.join(" AND "),
      params: [clientId],
      orderBy: hasExpiry ? "(expires_at IS NULL) DESC, expires_at ASC, id DESC" : "id DESC",
      limit: 100,
    });
  } catch {
    return [];
  }
  if (instances.length === 0) return [];

  const out: QuickBookClientGift[] = [];
  for (const inst of instances) {
    const instanceId = Number(inst.id ?? 0);
    const giftId = Number(inst.gift_id ?? 0);
    if (instanceId <= 0 || giftId <= 0) continue;
    try {
      // The reward set lives on the gift definition (gifts.reward_items_json), joined by
      // the instance's gift_id (parity with Gifts::clientAvailableInstances' JOIN gifts).
      const giftRows = await tenantSelect<RowDataPacket>({
        slug,
        table: "gifts",
        columns: "reward_items_json",
        where: "id = ?",
        params: [giftId],
        limit: 1,
      });
      const rewardItems = parseGiftRewardItems(giftRows[0]?.reward_items_json);
      for (let index = 0; index < rewardItems.length; index += 1) {
        const item = rewardItems[index];
        if (item.type !== "service" || item.serviceId <= 0) continue; // only service rewards cover a service
        const redeemed = await giftRewardRedeemedQty(slug, instanceId, index, item.serviceId);
        if (item.qty - redeemed <= 0) continue; // exhausted -> not offerable
        const name = await serviceNameById(slug, item.serviceId, "Servizio");
        out.push({ instance_id: instanceId, reward_item_index: index, service_id: item.serviceId, name });
      }
    } catch {
      // tolerate the gifts row / tracking table being absent for this instance
    }
  }
  return out;
}
