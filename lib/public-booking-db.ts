import "server-only";

import { randomBytes } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { columnExists, tenantInsert, tenantSelect, tenantTable, tenantUpdate } from "@/lib/tenant-db";

export type PublicBookingBusiness = {
  name: string;
  about: string;
  email: string;
  phone: string;
  website: string;
};

export type PublicBookingLocation = {
  id: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  bookingEnabled: boolean;
  hoursToday: string;
};

export type PublicBookingCategory = {
  id: number;
  name: string;
};

export type PublicBookingService = {
  id: number;
  name: string;
  description: string;
  categoryId: number | null;
  duration: number;
  price: number;
  noOperator: boolean;
  locationIds: number[];
};

export type PublicBookingStaff = {
  id: number;
  name: string;
  serviceIds: number[];
  active: boolean;
};

export type PublicBookingBenefit = {
  id: string;
  type: "coupon" | "promotion" | "giftcard";
  label: string;
  detail: string;
  code?: string;
  promotionId?: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
};

export type PublicBookingContext = {
  business: PublicBookingBusiness;
  locations: PublicBookingLocation[];
  categories: PublicBookingCategory[];
  services: PublicBookingService[];
  staff: PublicBookingStaff[];
  benefits: PublicBookingBenefit[];
  today: string;
};

export type PublicBookingSlot = {
  time: string;
  available: boolean;
  staffId: number | null;
  staffName: string;
  reason: string;
};

export type PublicBookingHold = {
  token: string;
  expiresAt: string;
  date: string;
  time: string;
  staffId: number | null;
  staffName: string;
};

export type PublicBookingConfirmation = {
  id: number;
  publicCode: string;
  status: string;
  date: string;
  time: string;
  total: number;
  discount: number;
  clientId: number;
  staffId: number | null;
  locationId: number | null;
};

type ServiceRow = RowDataPacket & {
  id: number;
  name: string;
  category_id: number | null;
  duration_min: number;
  price: number | string;
  no_operator: number;
};

type StaffCandidate = {
  id: number | null;
  name: string;
  serviceIds: Set<number>;
};

type BusyRange = {
  start: number;
  end: number;
  locationId: number | null;
  staffIds: number[];
};

export async function publicBookingContext(slug: string): Promise<PublicBookingContext> {
  const [businessRows, locationRows, categoryRows, serviceRows, serviceLocationRows, staffRows, staffServiceRows] = await Promise.all([
    tenantSelect<RowDataPacket>({ slug, table: "businesses", orderBy: "id ASC", limit: 1 }),
    tenantSelect<RowDataPacket>({
      slug,
      table: "locations",
      where: "COALESCE(is_active, 1) = 1 AND COALESCE(booking_enabled, 1) = 1",
      orderBy: "sort_order ASC, name ASC",
    }),
    tenantSelect<RowDataPacket>({ slug, table: "service_categories", orderBy: "sort_order ASC, name ASC" }).catch(() => [] as RowDataPacket[]),
    tenantSelect<ServiceRow>({
      slug,
      table: "services",
      where: "COALESCE(is_active, 1) = 1 AND COALESCE(booking_enabled, 1) = 1",
      orderBy: "sort_order ASC, name ASC",
    }),
    tenantSelect<RowDataPacket>({ slug, table: "service_locations" }).catch(() => [] as RowDataPacket[]),
    tenantSelect<RowDataPacket>({
      slug,
      table: "staff",
      where: "COALESCE(is_active, 1) = 1",
      orderBy: "full_name ASC, id ASC",
    }).catch(() => [] as RowDataPacket[]),
    tenantSelect<RowDataPacket>({ slug, table: "staff_services" }).catch(() => [] as RowDataPacket[]),
  ]);

  const business = businessRows[0] ?? {};
  const serviceLocations = groupNumberMap(serviceLocationRows, "service_id", "location_id");
  const staffServices = groupNumberMap(staffServiceRows, "staff_id", "service_id");
  const today = todayIsoLocal();

  const categories = categoryRows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Servizi"),
  }));
  const serviceCategoryIds = new Set(categories.map((category) => category.id));
  for (const service of serviceRows) {
    const categoryId = nullableNumber(service.category_id);
    if (categoryId && !serviceCategoryIds.has(categoryId)) {
      serviceCategoryIds.add(categoryId);
      categories.push({ id: categoryId, name: `Categoria #${categoryId}` });
    }
  }

  const locations = await Promise.all(locationRows.map(async (row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Sede"),
    address: [row.address, row.legal_city].map((value) => String(value ?? "").trim()).filter(Boolean).join(", "),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? row.whatsapp ?? ""),
    bookingEnabled: Number(row.booking_enabled ?? 1) === 1,
    hoursToday: await hoursLabel(slug, nullableNumber(row.id), today),
  })));

  return {
    business: {
      name: String(business.name ?? "BeautySuite"),
      about: String(business.booking_about_text ?? ""),
      email: String(business.email ?? ""),
      phone: String(business.phone ?? ""),
      website: String(business.website ?? ""),
    },
    locations,
    categories,
    services: serviceRows.map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.name ?? "Servizio"),
      description: "",
      categoryId: nullableNumber(row.category_id),
      duration: Math.max(5, Number(row.duration_min ?? 30)),
      price: roundMoney(Number(row.price ?? 0)),
      noOperator: Number(row.no_operator ?? 0) === 1,
      locationIds: serviceLocations.get(Number(row.id ?? 0)) ?? [],
    })),
    staff: staffRows.map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.full_name ?? "Operatore"),
      serviceIds: staffServices.get(Number(row.id ?? 0)) ?? [],
      active: Number(row.is_active ?? 1) === 1,
    })),
    benefits: await publicBookingBenefits(slug),
    today,
  };
}

export async function publicBookingSlots({
  slug,
  date,
  serviceIds,
  staffId,
  locationId,
}: {
  slug: string;
  date: string;
  serviceIds: number[];
  staffId?: number | null;
  locationId?: number | null;
}): Promise<PublicBookingSlot[]> {
  const normalizedDate = normalizeDate(date);
  const services = await publicServicesByIds(slug, serviceIds, locationId ?? null);
  const duration = services.reduce((sum, service) => sum + Math.max(5, Number(service.duration_min ?? 30)), 0);
  if (duration <= 0) throw new Error("Servizio non valido.");

  const candidates = await eligibleStaffCandidates(slug, services, staffId ?? null);
  if (!candidates.length) {
    return [];
  }

  const intervals = await businessIntervals(slug, locationId ?? null, normalizedDate);
  if (!intervals.length) {
    return [];
  }

  const busyRanges = await busyRangesForDate(slug, normalizedDate);
  const slots: PublicBookingSlot[] = [];
  const minStart = minimumStartForDate(normalizedDate);

  for (const [opens, closes] of intervals) {
    for (let start = opens; start + duration <= closes; start += 5) {
      if (start < minStart) continue;
      const free = candidates.find((candidate) =>
        candidateFree(candidate, start, start + duration, locationId ?? null, busyRanges),
      );
      slots.push({
        time: minutesToTime(start),
        available: Boolean(free),
        staffId: free?.id ?? null,
        staffName: free?.name ?? "",
        reason: free ? "Disponibile" : "Orario occupato",
      });
    }
  }

  return slots;
}

export async function holdPublicBookingSlot({
  slug,
  date,
  time,
  serviceIds,
  staffId,
  locationId,
  ownerKey,
}: {
  slug: string;
  date: string;
  time: string;
  serviceIds: number[];
  staffId?: number | null;
  locationId?: number | null;
  ownerKey: string;
}): Promise<PublicBookingHold> {
  const normalizedDate = normalizeDate(date);
  const normalizedTime = normalizeTime(time);
  const slots = await publicBookingSlots({ slug, date: normalizedDate, serviceIds, staffId, locationId });
  const selected = slots.find((slot) => slot.time === normalizedTime && slot.available);
  if (!selected) throw new Error("Orario non piu disponibile. Scegli un altro slot.");

  const services = await publicServicesByIds(slug, serviceIds, locationId ?? null);
  const start = timeToMinutes(normalizedTime);
  const duration = services.reduce((sum, service) => sum + Math.max(5, Number(service.duration_min ?? 30)), 0);
  const expiresAt = addSecondsSqlDate(new Date(), 150);
  const token = randomHex(64);
  const selectedStaffId = staffId && staffId > 0 ? staffId : selected.staffId;

  await tenantInsert(await tenantTable(slug, "appointment_holds"), {
    token,
    channel: "public",
    owner_key: ownerKey || "public",
    location_id: locationId && locationId > 0 ? locationId : null,
    starts_at: sqlDateTime(normalizedDate, normalizedTime),
    ends_at: sqlDateTime(normalizedDate, minutesToTime(start + duration)),
    service_ids_json: JSON.stringify(services.map((service) => Number(service.id))),
    staff_ids_json: JSON.stringify(selectedStaffId ? [selectedStaffId] : []),
    cabin_ids_json: JSON.stringify(services.map((service) => nullableNumber(service.cabin_id)).filter(Boolean)),
    segments_json: JSON.stringify(buildSegments(normalizedDate, normalizedTime, services, selectedStaffId)),
    resource_blocks_json: JSON.stringify([]),
    status: "active",
    expires_at: expiresAt,
  });

  return {
    token,
    expiresAt,
    date: normalizedDate,
    time: normalizedTime,
    staffId: selectedStaffId ?? null,
    staffName: selected.staffName,
  };
}

export async function releasePublicBookingHold({
  slug,
  token,
  ownerKey,
}: {
  slug: string;
  token: string;
  ownerKey: string;
}): Promise<boolean> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    where: "token = ? AND owner_key = ? AND status = 'active'",
    params: [token, ownerKey || "public"],
    limit: 1,
  });
  const id = Number(rows[0]?.id ?? 0);
  if (id <= 0) return false;
  return (await tenantUpdate({ slug, table: "appointment_holds", id, values: { status: "released" } })) > 0;
}

export async function renewPublicBookingHold({
  slug,
  token,
  ownerKey,
}: {
  slug: string;
  token: string;
  ownerKey: string;
}): Promise<PublicBookingHold> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    where: "token = ? AND owner_key = ? AND status = 'active'",
    params: [token, ownerKey || "public"],
    limit: 1,
  });
  const row = rows[0];
  const id = Number(row?.id ?? 0);
  if (id <= 0) throw new Error("Hold non trovato.");

  const expiresAt = addSecondsSqlDate(new Date(), 150);
  await tenantUpdate({ slug, table: "appointment_holds", id, values: { expires_at: expiresAt } });
  const staffId = parseNumberArray(row.staff_ids_json)[0] ?? null;

  return {
    token,
    expiresAt,
    date: dateFromSql(row.starts_at),
    time: timeFromSql(row.starts_at),
    staffId,
    staffName: staffId ? `Operatore #${staffId}` : "",
  };
}

export async function confirmPublicBooking({
  slug,
  date,
  time,
  serviceIds,
  staffId,
  locationId,
  ownerKey,
  holdToken,
  clientName,
  clientEmail,
  clientPhone,
  couponCode,
  promotionId,
  notes,
}: {
  slug: string;
  date: string;
  time: string;
  serviceIds: number[];
  staffId?: number | null;
  locationId?: number | null;
  ownerKey: string;
  holdToken?: string | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  couponCode?: string;
  promotionId?: number | null;
  notes?: string;
}): Promise<PublicBookingConfirmation> {
  const normalizedDate = normalizeDate(date);
  const normalizedTime = normalizeTime(time);
  const services = await publicServicesByIds(slug, serviceIds, locationId ?? null);
  const start = timeToMinutes(normalizedTime);
  const duration = services.reduce((sum, service) => sum + Math.max(5, Number(service.duration_min ?? 30)), 0);
  const selectedStaffId = staffId && staffId > 0 ? staffId : null;

  if (holdToken) {
    await assertActivePublicHold({
      slug,
      token: holdToken,
      ownerKey,
      date: normalizedDate,
      time: normalizedTime,
      serviceIds: services.map((service) => Number(service.id)),
      staffId: selectedStaffId,
      locationId: locationId ?? null,
    });
  } else {
    const slots = await publicBookingSlots({ slug, date: normalizedDate, serviceIds, staffId: selectedStaffId, locationId });
    if (!slots.some((slot) => slot.time === normalizedTime && slot.available)) {
      throw new Error("Orario non disponibile.");
    }
  }

  const client = await resolvePublicClient({
    slug,
    name: clientName,
    email: clientEmail ?? "",
    phone: clientPhone ?? "",
    locationId: locationId ?? null,
  });
  const subtotal = services.reduce((sum, service) => sum + Number(service.price ?? 0), 0);
  const discount = await publicDiscount(slug, subtotal, couponCode, promotionId ?? null);
  const publicCode = randomHex(10).toUpperCase();
  const appointments = await tenantTable(slug, "appointments");
  const values: Record<string, unknown> = {
    client_id: client.id,
    service_id: Number(services[0]?.id ?? 0) || null,
    cabin_id: nullableNumber(services[0]?.cabin_id),
    starts_at: sqlDateTime(normalizedDate, normalizedTime),
    ends_at: sqlDateTime(normalizedDate, minutesToTime(start + duration)),
    status: "pending",
    discount_type: discount.amount > 0 ? "fixed" : null,
    discount_value: discount.amount,
    promotion_id: promotionId && promotionId > 0 ? promotionId : null,
    location_id: locationId && locationId > 0 ? locationId : null,
    customer_notes: [notes, discount.label].filter(Boolean).join("\n") || null,
  };
  if (await columnExists(appointments.name, "public_code")) values.public_code = publicCode;
  const appointmentId = await tenantInsert(appointments, values);

  await insertPublicAppointmentServices(slug, appointmentId, services);
  if (selectedStaffId) await insertPublicAppointmentStaff(slug, appointmentId, selectedStaffId);
  if (locationId && locationId > 0) await insertPublicAppointmentLocation(slug, appointmentId, locationId);
  await insertPublicAppointmentSegments(slug, appointmentId, normalizedDate, normalizedTime, services, selectedStaffId);
  if (holdToken) await markPublicHoldConverted(slug, holdToken, ownerKey, appointmentId);

  return {
    id: appointmentId,
    publicCode,
    status: "pending",
    date: normalizedDate,
    time: normalizedTime,
    total: roundMoney(Math.max(0, subtotal - discount.amount)),
    discount: discount.amount,
    clientId: client.id,
    staffId: selectedStaffId,
    locationId: locationId ?? null,
  };
}

async function publicBookingBenefits(slug: string): Promise<PublicBookingBenefit[]> {
  const today = todayIsoLocal();
  const [coupons, promotions] = await Promise.all([
    tenantSelect<RowDataPacket>({
      slug,
      table: "coupons",
      where: "COALESCE(is_active, 1) = 1 AND deleted_at IS NULL AND cancelled_at IS NULL AND (valid_from IS NULL OR valid_from <= ?) AND (valid_to IS NULL OR valid_to >= ?)",
      params: [today, today],
      orderBy: "created_at DESC, id DESC",
      limit: 4,
    }).catch(() => [] as RowDataPacket[]),
    tenantSelect<RowDataPacket>({
      slug,
      table: "promotions",
      where: "COALESCE(is_active, 1) = 1 AND COALESCE(show_in_booking, 1) = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)",
      params: [today, today],
      orderBy: "priority DESC, id DESC",
      limit: 4,
    }).catch(() => [] as RowDataPacket[]),
  ]);

  return [
    ...coupons.map((row) => ({
      id: `coupon:${row.id}`,
      type: "coupon" as const,
      label: String(row.code ?? "Coupon"),
      detail: benefitDetail(row.discount_type, row.discount_value),
      code: String(row.code ?? ""),
      discountType: discountKind(row.discount_type),
      discountValue: roundMoney(Number(row.discount_value ?? 0)),
    })),
    ...promotions.map((row) => ({
      id: `promotion:${row.id}`,
      type: "promotion" as const,
      label: String(row.title ?? "Promozione"),
      detail: benefitDetail(row.discount_type, row.discount_value),
      promotionId: Number(row.id ?? 0),
      discountType: discountKind(row.discount_type),
      discountValue: roundMoney(Number(row.discount_value ?? 0)),
    })),
  ];
}

async function publicServicesByIds(slug: string, rawServiceIds: number[], locationId: number | null): Promise<ServiceRow[]> {
  const ids = Array.from(new Set(rawServiceIds.map((id) => Math.floor(id)).filter((id) => id > 0)));
  if (!ids.length) throw new Error("Seleziona almeno un servizio.");
  const placeholders = ids.map(() => "?").join(",");
  const rows = await tenantSelect<ServiceRow>({
    slug,
    table: "services",
    where: `id IN (${placeholders}) AND COALESCE(is_active, 1) = 1 AND COALESCE(booking_enabled, 1) = 1`,
    params: ids,
    orderBy: "sort_order ASC, id ASC",
  });
  if (rows.length !== ids.length) throw new Error("Uno o piu servizi non sono prenotabili.");
  if (locationId && locationId > 0) {
    const locationRows = await tenantSelect<RowDataPacket>({ slug, table: "service_locations" }).catch(() => [] as RowDataPacket[]);
    const byService = groupNumberMap(locationRows, "service_id", "location_id");
    const blocked = rows.find((row) => {
      const allowed = byService.get(Number(row.id ?? 0)) ?? [];
      return allowed.length > 0 && !allowed.includes(locationId);
    });
    if (blocked) throw new Error("Servizio non disponibile nella sede selezionata.");
  }
  return rows;
}

async function eligibleStaffCandidates(slug: string, services: ServiceRow[], requestedStaffId: number | null): Promise<StaffCandidate[]> {
  if (services.every((service) => Number(service.no_operator ?? 0) === 1)) {
    return [{ id: null, name: "", serviceIds: new Set() }];
  }

  const [staffRows, staffServiceRows] = await Promise.all([
    tenantSelect<RowDataPacket>({
      slug,
      table: "staff",
      where: requestedStaffId ? "id = ? AND COALESCE(is_active, 1) = 1" : "COALESCE(is_active, 1) = 1",
      params: requestedStaffId ? [requestedStaffId] : [],
      orderBy: "full_name ASC, id ASC",
    }),
    tenantSelect<RowDataPacket>({ slug, table: "staff_services" }).catch(() => [] as RowDataPacket[]),
  ]);
  const serviceIds = services.filter((service) => Number(service.no_operator ?? 0) !== 1).map((service) => Number(service.id));
  const mappedByStaff = new Map<number, Set<number>>();
  const mappedServiceIds = new Set<number>();
  for (const row of staffServiceRows) {
    const staffId = Number(row.staff_id ?? 0);
    const serviceId = Number(row.service_id ?? 0);
    if (!mappedByStaff.has(staffId)) mappedByStaff.set(staffId, new Set());
    mappedByStaff.get(staffId)!.add(serviceId);
    mappedServiceIds.add(serviceId);
  }

  return staffRows
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.full_name ?? "Operatore"),
      serviceIds: mappedByStaff.get(Number(row.id ?? 0)) ?? new Set<number>(),
    }))
    .filter((staff) => serviceIds.every((serviceId) => !mappedServiceIds.has(serviceId) || staff.serviceIds.has(serviceId)));
}

async function businessIntervals(slug: string, locationId: number | null, date: string): Promise<Array<[number, number]>> {
  const exceptionRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "business_hours_exceptions",
    where: locationId ? "date = ? AND (location_id = ? OR location_id IS NULL)" : "date = ? AND location_id IS NULL",
    params: locationId ? [date, locationId] : [date],
    orderBy: "location_id DESC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  const exception = preferredLocationRow(exceptionRows, locationId);
  if (exception) return intervalsFromHoursRow(exception);

  const dow = new Date(`${date}T12:00:00`).getDay();
  const hourRows = await tenantSelect<RowDataPacket>({
    slug,
    table: "business_hours",
    where: locationId ? "dow = ? AND (location_id = ? OR location_id IS NULL)" : "dow = ? AND location_id IS NULL",
    params: locationId ? [dow, locationId] : [dow],
    orderBy: "location_id DESC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  const hours = preferredLocationRow(hourRows, locationId);
  if (!hours) return [[9 * 60, 19 * 60]];
  return intervalsFromHoursRow(hours);
}

async function hoursLabel(slug: string, locationId: number | null, date: string): Promise<string> {
  const intervals = await businessIntervals(slug, locationId, date);
  if (!intervals.length) return "Oggi chiuso";
  return `Oggi ${intervals.map(([start, end]) => `${minutesToTime(start)} - ${minutesToTime(end)}`).join(" / ")}`;
}

async function busyRangesForDate(slug: string, date: string): Promise<BusyRange[]> {
  const [appointmentRows, holdRows] = await Promise.all([
    tenantSelect<RowDataPacket>({
      slug,
      table: "appointments",
      where: "DATE(starts_at) = ? AND status NOT IN ('canceled','cancelled')",
      params: [date],
      orderBy: "starts_at ASC",
    }).catch(() => [] as RowDataPacket[]),
    tenantSelect<RowDataPacket>({
      slug,
      table: "appointment_holds",
      where: "DATE(starts_at) = ? AND status = 'active' AND expires_at > NOW()",
      params: [date],
      orderBy: "starts_at ASC",
    }).catch(() => [] as RowDataPacket[]),
  ]);

  const appointments = await Promise.all(appointmentRows.map(async (row) => ({
    start: timeToMinutes(timeFromSql(row.starts_at)),
    end: timeToMinutes(timeFromSql(row.ends_at)),
    locationId: nullableNumber(row.location_id),
    staffIds: await appointmentStaffIds(slug, Number(row.id ?? 0)),
  })));

  const holds = holdRows.map((row) => ({
    start: timeToMinutes(timeFromSql(row.starts_at)),
    end: timeToMinutes(timeFromSql(row.ends_at)),
    locationId: nullableNumber(row.location_id),
    staffIds: parseNumberArray(row.staff_ids_json),
  }));

  return [...appointments, ...holds].filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start);
}

async function appointmentStaffIds(slug: string, appointmentId: number): Promise<number[]> {
  if (appointmentId <= 0) return [];
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_staff",
    where: "appointment_id = ?",
    params: [appointmentId],
  }).catch(() => [] as RowDataPacket[]);
  return rows.map((row) => Number(row.staff_id ?? 0)).filter((id) => id > 0);
}

function candidateFree(candidate: StaffCandidate, start: number, end: number, locationId: number | null, busyRanges: BusyRange[]): boolean {
  for (const busy of busyRanges) {
    if (!sameLocation(locationId, busy.locationId)) continue;
    if (!overlaps(start, end, busy.start, busy.end)) continue;
    if (candidate.id === null) return false;
    if (!busy.staffIds.length || busy.staffIds.includes(candidate.id)) return false;
  }
  return true;
}

async function assertActivePublicHold({
  slug,
  token,
  ownerKey,
  date,
  time,
  serviceIds,
  staffId,
  locationId,
}: {
  slug: string;
  token: string;
  ownerKey: string;
  date: string;
  time: string;
  serviceIds: number[];
  staffId: number | null;
  locationId: number | null;
}): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    where: "token = ? AND owner_key = ? AND status = 'active' AND expires_at > NOW()",
    params: [token, ownerKey || "public"],
    limit: 1,
  });
  const hold = rows[0];
  if (!hold) throw new Error("Riserva non disponibile o scaduta.");
  const sameServices = serviceIds.every((id) => parseNumberArray(hold.service_ids_json).includes(id));
  const holdStaff = parseNumberArray(hold.staff_ids_json);
  const sameStaff = !staffId || !holdStaff.length || holdStaff.includes(staffId);
  const sameDateTime = dateFromSql(hold.starts_at) === date && timeFromSql(hold.starts_at) === time;
  const sameLocationId = sameLocation(locationId, nullableNumber(hold.location_id));
  if (!sameServices || !sameStaff || !sameDateTime || !sameLocationId) {
    throw new Error("La riserva non corrisponde alla prenotazione.");
  }
}

async function resolvePublicClient({
  slug,
  name,
  email,
  phone,
  locationId,
}: {
  slug: string;
  name: string;
  email: string;
  phone: string;
  locationId: number | null;
}): Promise<{ id: number; name: string }> {
  const normalizedName = name.trim() || email.trim() || phone.trim() || "Cliente online";
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (normalizedEmail) {
    clauses.push("LOWER(email) = ?");
    params.push(normalizedEmail);
  }
  if (normalizedPhone) {
    clauses.push("phone = ?");
    params.push(normalizedPhone);
  }
  if (!clauses.length) {
    clauses.push("LOWER(full_name) = ?");
    params.push(normalizedName.toLowerCase());
  }
  const existing = await tenantSelect<RowDataPacket>({
    slug,
    table: "clients",
    columns: "id,full_name",
    where: clauses.join(" OR "),
    params,
    limit: 1,
  });
  if (existing[0]) return { id: Number(existing[0].id), name: String(existing[0].full_name ?? normalizedName) };

  const id = await tenantInsert(await tenantTable(slug, "clients"), {
    full_name: normalizedName,
    first_name: firstName(normalizedName),
    last_name: lastName(normalizedName),
    email: normalizedEmail || null,
    phone: normalizedPhone || null,
    registration_date: todayIsoLocal(),
    points: 0,
    credit_balance: 0,
    is_blocked: 0,
    location_id: locationId,
  });
  return { id, name: normalizedName };
}

async function publicDiscount(slug: string, subtotal: number, couponCode?: string, promotionId?: number | null): Promise<{ amount: number; label: string }> {
  const today = todayIsoLocal();
  if (couponCode?.trim()) {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "coupons",
      where: "UPPER(code) = ? AND COALESCE(is_active, 1) = 1 AND deleted_at IS NULL AND cancelled_at IS NULL AND (valid_from IS NULL OR valid_from <= ?) AND (valid_to IS NULL OR valid_to >= ?)",
      params: [couponCode.trim().toUpperCase(), today, today],
      limit: 1,
    }).catch(() => [] as RowDataPacket[]);
    const coupon = rows[0];
    if (coupon && subtotal >= Number(coupon.min_subtotal ?? 0)) {
      return {
        amount: discountAmount(coupon.discount_type, coupon.discount_value, subtotal),
        label: `Coupon ${String(coupon.code ?? "").trim()}`,
      };
    }
  }

  if (promotionId && promotionId > 0) {
    const rows = await tenantSelect<RowDataPacket>({
      slug,
      table: "promotions",
      where: "id = ? AND COALESCE(is_active, 1) = 1 AND COALESCE(show_in_booking, 1) = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)",
      params: [promotionId, today, today],
      limit: 1,
    }).catch(() => [] as RowDataPacket[]);
    const promotion = rows[0];
    if (promotion && subtotal >= Number(promotion.min_subtotal ?? 0)) {
      return {
        amount: discountAmount(promotion.discount_type, promotion.discount_value, subtotal),
        label: `Promozione ${String(promotion.title ?? "").trim()}`,
      };
    }
  }

  return { amount: 0, label: "" };
}

async function insertPublicAppointmentServices(slug: string, appointmentId: number, services: ServiceRow[]): Promise<void> {
  for (const service of services) {
    await tenantInsert(await tenantTable(slug, "appointment_services"), {
      appointment_id: appointmentId,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      service_category_id: nullableNumber(service.category_id),
      qty: 1,
      price: Number(service.price ?? 0),
      list_price: Number(service.price ?? 0),
      duration_min: Number(service.duration_min ?? 30),
    }).catch(() => 0);
  }
}

async function insertPublicAppointmentStaff(slug: string, appointmentId: number, staffId: number): Promise<void> {
  await tenantInsert(await tenantTable(slug, "appointment_staff"), { appointment_id: appointmentId, staff_id: staffId }).catch(() => 0);
}

async function insertPublicAppointmentLocation(slug: string, appointmentId: number, locationId: number): Promise<void> {
  await tenantInsert(await tenantTable(slug, "appointment_locations"), { appointment_id: appointmentId, location_id: locationId }).catch(() => 0);
}

async function insertPublicAppointmentSegments(slug: string, appointmentId: number, date: string, time: string, services: ServiceRow[], staffId: number | null): Promise<void> {
  let cursor = timeToMinutes(time);
  let position = 1;
  for (const service of services) {
    const duration = Math.max(5, Number(service.duration_min ?? 30));
    await tenantInsert(await tenantTable(slug, "appointment_segments"), {
      appointment_id: appointmentId,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      staff_id: staffId ?? 0,
      position,
      starts_at: sqlDateTime(date, minutesToTime(cursor)),
      ends_at: sqlDateTime(date, minutesToTime(cursor + duration)),
      duration_minutes: duration,
      cabin_id: nullableNumber(service.cabin_id),
    }).catch(() => 0);
    cursor += duration;
    position += 1;
  }
}

async function markPublicHoldConverted(slug: string, token: string, ownerKey: string, appointmentId: number): Promise<void> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "appointment_holds",
    where: "token = ? AND owner_key = ?",
    params: [token, ownerKey || "public"],
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  const id = Number(rows[0]?.id ?? 0);
  if (id > 0) {
    await tenantUpdate({ slug, table: "appointment_holds", id, values: { status: "converted", appointment_id: appointmentId } }).catch(() => 0);
  }
}

function buildSegments(date: string, time: string, services: ServiceRow[], staffId: number | null): Array<Record<string, unknown>> {
  let cursor = timeToMinutes(time);
  return services.map((service, index) => {
    const duration = Math.max(5, Number(service.duration_min ?? 30));
    const segment = {
      position: index + 1,
      service_id: Number(service.id ?? 0),
      service_name: String(service.name ?? ""),
      staff_id: staffId ?? null,
      starts_at: sqlDateTime(date, minutesToTime(cursor)),
      ends_at: sqlDateTime(date, minutesToTime(cursor + duration)),
      duration_minutes: duration,
      cabin_id: nullableNumber(service.cabin_id),
    };
    cursor += duration;
    return segment;
  });
}

function groupNumberMap(rows: RowDataPacket[], keyColumn: string, valueColumn: string): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const key = Number(row[keyColumn] ?? 0);
    const value = Number(row[valueColumn] ?? 0);
    if (key <= 0 || value <= 0) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(value);
  }
  return map;
}

function preferredLocationRow(rows: RowDataPacket[], locationId: number | null): RowDataPacket | null {
  if (!rows.length) return null;
  return rows.find((row) => nullableNumber(row.location_id) === locationId) ?? rows.find((row) => nullableNumber(row.location_id) === null) ?? rows[0] ?? null;
}

function intervalsFromHoursRow(row: RowDataPacket): Array<[number, number]> {
  if (Number(row.is_closed ?? 0) === 1) return [];
  const intervals: Array<[number, number]> = [];
  const first = intervalFromTimes(row.opens, row.closes);
  const second = intervalFromTimes(row.opens2, row.closes2);
  if (first) intervals.push(first);
  if (second) intervals.push(second);
  return intervals;
}

function intervalFromTimes(open: unknown, close: unknown): [number, number] | null {
  const start = timeToMinutes(timeFromSql(open));
  const end = timeToMinutes(timeFromSql(close));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return [start, end];
}

function benefitDetail(type: unknown, value: unknown): string {
  const amount = roundMoney(Number(value ?? 0));
  return discountKind(type) === "percent" ? `${amount}% di sconto` : `${amount} euro di sconto`;
}

function discountKind(type: unknown): "percent" | "fixed" {
  return String(type ?? "") === "fixed" ? "fixed" : "percent";
}

function discountAmount(type: unknown, value: unknown, subtotal: number): number {
  const amount = discountKind(type) === "percent" ? subtotal * (Number(value ?? 0) / 100) : Number(value ?? 0);
  return roundMoney(Math.max(0, Math.min(subtotal, amount)));
}

function parseNumberArray(value: unknown): number[] {
  if (!value) return [];
  try {
    const decoded = JSON.parse(String(value));
    if (Array.isArray(decoded)) return decoded.map((item) => Number(item)).filter((item) => item > 0);
  } catch {
    // fallback below
  }
  return String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => item > 0);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDate(value: string): string {
  const match = String(value ?? "").match(/^\d{4}-\d{2}-\d{2}$/);
  if (match) return match[0];
  return todayIsoLocal();
}

function normalizeTime(value: string): string {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "09:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeToMinutes(value: string): number {
  const match = normalizeTime(value).match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function timeFromSql(value: unknown): string {
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function dateFromSql(value: unknown): string {
  if (value instanceof Date) return dateIsoLocal(value);
  const match = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? todayIsoLocal();
}

function sqlDateTime(date: string, time: string): string {
  return `${normalizeDate(date)} ${normalizeTime(time)}:00`;
}

function addSecondsSqlDate(date: Date, seconds: number): string {
  const next = new Date(date.getTime() + seconds * 1000);
  return `${dateIsoLocal(next)} ${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}:${String(next.getSeconds()).padStart(2, "0")}`;
}

function todayIsoLocal(): string {
  return dateIsoLocal(new Date());
}

function dateIsoLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function minimumStartForDate(date: string): number {
  if (date !== todayIsoLocal()) return 0;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

function sameLocation(left: number | null, right: number | null): boolean {
  if (!left || !right) return true;
  return left === right;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}
