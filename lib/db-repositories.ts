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
import { tenantDelete, tenantInsert, tenantSelect, tenantTable, tenantUpdate, columnExists, dbExecute, dbQuery, quoteIdentifier, tableExists, tenantIdForSlug } from "@/lib/tenant-db";
import { buildModernEmailTemplate, emailConfigured, sendEmail } from "@/lib/email";

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
}): Promise<AppointmentWithMeta> {
  const client = await resolveClientForAppointment(slug, clientName, locationId);
  const service = await resolveServiceForAppointment(slug, serviceName);
  const staff = operator ? await resolveStaffForAppointment(slug, operator) : null;
  const normalizedTime = normalizeTime(time);
  const start = `${date} ${normalizedTime}:00`;
  const duration = Number(service.duration_min ?? 30);
  const end = addMinutesSqlDate(start, duration);
  const token = (holdToken ?? "").trim();
  if (token) {
    await assertDbAppointmentHold({
      slug,
      token,
      ownerKey: "manage",
      startsAt: start,
      serviceId: Number(service.id ?? 0),
      staffId: staff ? Number(staff.id ?? 0) : null,
      locationId,
    });
  }
  const appointments = await tenantTable(slug, "appointments");
  const id = await tenantInsert(appointments, {
    client_id: client.id,
    service_id: service.id,
    cabin_id: service.cabin_id ?? null,
    starts_at: start,
    ends_at: end,
    status: "pending",
    discount_value: 0,
    location_id: locationId,
    staff_notes: staffNotes || null,
    customer_notes: customerNotes || null,
  });

  await insertAppointmentService(slug, id, service);
  if (staff) await insertAppointmentStaff(slug, id, staff.id);
  if (locationId) await insertAppointmentLocation(slug, id, locationId);
  await insertAppointmentSegment(slug, id, service, staff ? Number(staff.id ?? 0) : null, start, end, duration);
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
}): Promise<AppointmentWithMeta> {
  // Tenant-scoped existence guard: the SELECT only returns rows for this tenant,
  // so a row from another tenant (or a missing id) yields no match.
  const existingRows = await tenantSelect<RowDataPacket>({ slug, table: "appointments", columns: "id", where: "id = ?", params: [id], limit: 1 });
  if (!existingRows[0]) throw new Error("Appuntamento non trovato.");

  const client = await resolveClientForAppointment(slug, clientName, locationId);
  const service = await resolveServiceForAppointment(slug, serviceName);
  const staff = operator ? await resolveStaffForAppointment(slug, operator) : null;
  const normalizedTime = normalizeTime(time);
  const start = `${date} ${normalizedTime}:00`;
  const duration = Number(service.duration_min ?? 30);
  const end = addMinutesSqlDate(start, duration);
  const token = (holdToken ?? "").trim();
  if (token) {
    await assertDbAppointmentHold({
      slug,
      token,
      ownerKey: "manage",
      startsAt: start,
      serviceId: Number(service.id ?? 0),
      staffId: staff ? Number(staff.id ?? 0) : null,
      locationId,
    });
  }

  await tenantUpdate({
    slug,
    table: "appointments",
    id,
    values: {
      client_id: client.id,
      service_id: service.id,
      cabin_id: service.cabin_id ?? null,
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

  await insertAppointmentService(slug, id, service);
  if (staff) await insertAppointmentStaff(slug, id, staff.id);
  if (locationId) await insertAppointmentLocation(slug, id, locationId);
  await insertAppointmentSegment(slug, id, service, staff ? Number(staff.id ?? 0) : null, start, end, duration);
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

async function insertAppointmentSegment(
  slug: string,
  appointmentId: number,
  service: RowDataPacket,
  staffId: number | null,
  startsAt: string,
  endsAt: string,
  durationMinutes: number,
): Promise<void> {
  try {
    await tenantInsert(await tenantTable(slug, "appointment_segments"), {
      appointment_id: appointmentId,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      staff_id: staffId ?? 0,
      position: 1,
      starts_at: startsAt,
      ends_at: endsAt,
      duration_minutes: durationMinutes,
      cabin_id: service.cabin_id ?? null,
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
