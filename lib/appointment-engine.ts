import {
  operators,
  services,
  locations,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/demo-data";
import {
  appendStoreAppointment,
  clearStoreAppointmentHolds,
  defaultTenantSlug,
  listServices,
  listStoreAppointmentHolds,
  listStoreAppointments,
  replaceStoreAppointmentHolds,
  replaceStoreAppointments,
  resetStoreAppointments,
} from "@/lib/tenant-store";

export type AppointmentWithMeta = Appointment & {
  date?: string;
  locationId?: number | null;
  holdToken?: string;
};

export type AppointmentHold = {
  token: string;
  channel: "backend" | "public";
  ownerKey: string;
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  serviceNames: string[];
  staffNames: string[];
  locationId: number | null;
  expiresAt: string;
  convertedAppointmentId?: number;
};

export type SlotAvailability = {
  time: string;
  available: boolean;
  operator: string | null;
  reason: string;
};

export type BuildSlotsInput = {
  date: string;
  serviceNames: string[];
  staffName?: string | null;
  locationId?: number | null;
  appointments?: AppointmentWithMeta[];
  holds?: AppointmentHold[];
  stepMinutes?: number;
  excludeAppointmentId?: number;
  excludeHoldToken?: string;
};

export type CreateAppointmentInput = {
  appointments: AppointmentWithMeta[];
  clientName: string;
  serviceName: string;
  operator: string;
  time: string;
  date?: string;
  locationId?: number | null;
  holdToken?: string;
};

const statusAliases: Record<string, AppointmentStatus> = {
  confirmed: "Confermato",
  confermato: "Confermato",
  pending: "In attesa",
  waiting: "In attesa",
  requested: "In attesa",
  "in attesa": "In attesa",
  completed: "Completato",
  complete: "Completato",
  completato: "Completato",
};

const serviceOperatorMap: Record<string, string[]> = {
  viso: ["Marta", "Sara"],
  nails: ["Sara", "Livia"],
  manicure: ["Sara", "Livia"],
  corpo: ["Nora", "Livia"],
  massaggio: ["Nora", "Livia"],
  sguardo: ["Marta", "Sara"],
  ciglia: ["Marta", "Sara"],
};

export function normalizeAppointmentStatus(value: unknown): AppointmentStatus {
  const key = String(value ?? "").trim().toLowerCase();
  return statusAliases[key] ?? "In attesa";
}

export function statusLabel(status: AppointmentStatus): string {
  return status;
}

export function parseDurationMinutes(value: string | number | null | undefined, fallback = 30): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);

  const match = String(value ?? "").match(/(\d+)/);
  if (!match) return fallback;

  const minutes = Number.parseInt(match[1], 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
}

export function parseEuroAmount(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value ?? "")
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/);

  return normalized ? Number.parseFloat(normalized[0]) : 0;
}

export function serviceDurationMinutes(serviceName: string): number {
  const service =
    listServices({ slug: defaultTenantSlug, includeInactive: true }).find((item) => item.name === serviceName) ??
    services.find((item) => item.name === serviceName);
  return parseDurationMinutes(service?.duration, 30);
}

export function totalServiceDurationMinutes(serviceNames: string[]): number {
  const firstServiceName = listServices({ slug: defaultTenantSlug, includeInactive: true })[0]?.name ?? services[0]?.name ?? "";
  const selected = serviceNames.length > 0 ? serviceNames : [firstServiceName];
  return selected.reduce((total, serviceName) => total + serviceDurationMinutes(serviceName), 0);
}

export function servicePriceLabel(serviceName: string): string {
  return (
    listServices({ slug: defaultTenantSlug, includeInactive: true }).find((service) => service.name === serviceName)?.price ??
    services.find((service) => service.name === serviceName)?.price ??
    "0 euro"
  );
}

export function staffForService(serviceName: string): string[] {
  const service =
    listServices({ slug: defaultTenantSlug, includeInactive: true }).find((item) => item.name === serviceName) ??
    services.find((item) => item.name === serviceName);
  const haystack = `${serviceName} ${service?.category ?? ""}`.toLowerCase();

  for (const [keyword, staff] of Object.entries(serviceOperatorMap)) {
    if (haystack.includes(keyword)) return staff;
  }

  return operators;
}

export function staffForServices(serviceNames: string[]): string[] {
  const firstServiceName = listServices({ slug: defaultTenantSlug, includeInactive: true })[0]?.name ?? services[0]?.name ?? "";
  const selected = serviceNames.length > 0 ? serviceNames : [firstServiceName];
  const candidateSets = selected.map((serviceName) => staffForService(serviceName));
  const first = candidateSets[0] ?? operators;
  const shared = first.filter((operator) => candidateSets.every((set) => set.includes(operator)));

  return shared.length > 0 ? shared : Array.from(new Set(candidateSets.flat()));
}

export function timeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.NaN;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeTime(time: string): string {
  const minutes = timeToMinutes(time);
  return Number.isFinite(minutes) ? minutesToTime(minutes) : time;
}

export function dateTimeLabel(date: string, time: string): string {
  return `${date} ${normalizeTime(time)}:00`;
}

export function rangeOverlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

export function businessIntervalsForLocation(locationId: number | null | undefined): Array<[number, number]> {
  const location = locations.find((item) => item.id === locationId) ?? locations[0];
  const match = location?.hoursToday.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);

  if (!match) return [[9 * 60, 20 * 60]];

  const opens = timeToMinutes(match[1]);
  const closes = timeToMinutes(match[2]);

  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) {
    return [[9 * 60, 20 * 60]];
  }

  return [[opens, closes]];
}

export function activeAppointmentHolds(now = new Date()): AppointmentHold[] {
  const current = now.getTime();
  const active = appointmentHoldStore().filter((hold) => {
    if (hold.convertedAppointmentId) return false;
    return new Date(hold.expiresAt).getTime() > current;
  });

  replaceStoreAppointmentHolds(active, defaultTenantSlug);
  return active;
}

export function clearAppointmentHolds(): AppointmentHold[] {
  return clearStoreAppointmentHolds(defaultTenantSlug);
}

export function appointmentHoldStore(): AppointmentHold[] {
  return listStoreAppointmentHolds(defaultTenantSlug);
}

export function demoAppointmentStore(): AppointmentWithMeta[] {
  return listStoreAppointments(defaultTenantSlug);
}

export function listDemoAppointments(): AppointmentWithMeta[] {
  return listStoreAppointments(defaultTenantSlug);
}

export function replaceDemoAppointments(nextAppointments: AppointmentWithMeta[]): AppointmentWithMeta[] {
  return replaceStoreAppointments(nextAppointments, defaultTenantSlug);
}

export function appendDemoAppointment(appointment: AppointmentWithMeta): AppointmentWithMeta[] {
  return appendStoreAppointment(appointment, defaultTenantSlug);
}

export function resetDemoAppointments(): AppointmentWithMeta[] {
  return resetStoreAppointments(defaultTenantSlug);
}

export function buildSlots(input: BuildSlotsInput): SlotAvailability[] {
  const duration = Math.max(10, totalServiceDurationMinutes(input.serviceNames));
  const step = Math.max(5, input.stepMinutes ?? 30);
  const eligibleStaff = input.staffName
    ? [input.staffName]
    : staffForServices(input.serviceNames);
  const appointments = input.appointments ?? listDemoAppointments();
  const holds = input.holds ?? activeAppointmentHolds();
  const intervals = businessIntervalsForLocation(input.locationId);
  const output: SlotAvailability[] = [];

  for (const [opens, closes] of intervals) {
    for (let start = opens; start + duration <= closes; start += step) {
      const time = minutesToTime(start);
      const freeOperator = eligibleStaff.find((operator) =>
        operatorFree({
          operator,
          date: input.date,
          start,
          end: start + duration,
          locationId: input.locationId ?? null,
          appointments,
          holds,
          excludeAppointmentId: input.excludeAppointmentId,
          excludeHoldToken: input.excludeHoldToken,
        }),
      );

      output.push({
        time,
        available: Boolean(freeOperator),
        operator: freeOperator ?? null,
        reason: freeOperator ? "Disponibile" : "Operatore occupato",
      });
    }
  }

  return output;
}

export function createAppointmentHold({
  date,
  time,
  serviceNames,
  staffName,
  locationId = null,
  ownerKey = "backend",
  channel = "backend",
  appointments = listDemoAppointments(),
  ttlSeconds = 300,
  excludeAppointmentId,
}: {
  date: string;
  time: string;
  serviceNames: string[];
  staffName?: string | null;
  locationId?: number | null;
  ownerKey?: string;
  channel?: "backend" | "public";
  appointments?: AppointmentWithMeta[];
  ttlSeconds?: number;
  excludeAppointmentId?: number;
}): AppointmentHold {
  const normalizedTime = normalizeTime(time);
  const slots = buildSlots({
    date,
    serviceNames,
    staffName,
    locationId,
    appointments,
    excludeAppointmentId,
  });
  const selected = slots.find((slot) => slot.time === normalizedTime);

  if (!selected?.available) {
    throw new Error("Orario non piu disponibile. Ricarica e scegli un altro slot.");
  }

  const durationMinutes = totalServiceDurationMinutes(serviceNames);
  const start = timeToMinutes(normalizedTime);
  const token = randomToken();
  const now = new Date();
  const hold: AppointmentHold = {
    token,
    channel,
    ownerKey,
    date,
    time: normalizedTime,
    startsAt: dateTimeLabel(date, normalizedTime),
    endsAt: dateTimeLabel(date, minutesToTime(start + durationMinutes)),
    durationMinutes,
    serviceNames,
    staffNames: selected.operator ? [selected.operator] : [],
    locationId,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };

  appointmentHoldStore().push(hold);
  return hold;
}

export function releaseAppointmentHold(token: string, ownerKey = "backend"): boolean {
  const before = appointmentHoldStore().length;
  const nextHolds = appointmentHoldStore().filter(
    (hold) => !(hold.token === token && hold.ownerKey === ownerKey),
  );
  replaceStoreAppointmentHolds(nextHolds, defaultTenantSlug);

  return appointmentHoldStore().length < before;
}

export function renewAppointmentHold(token: string, ownerKey = "backend", ttlSeconds = 300): AppointmentHold {
  const hold = activeAppointmentHolds().find((item) => item.token === token && item.ownerKey === ownerKey);
  if (!hold) throw new Error("Riserva non disponibile o scaduta.");

  hold.expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { ...hold };
}

export function assertActiveHoldForSave({
  token,
  date,
  time,
  serviceNames,
  staffName,
  locationId,
  ownerKey = "backend",
}: {
  token: string;
  date: string;
  time: string;
  serviceNames: string[];
  staffName: string;
  locationId?: number | null;
  ownerKey?: string;
}): AppointmentHold {
  const hold = activeAppointmentHolds().find((item) => item.token === token && item.ownerKey === ownerKey);
  if (!hold) throw new Error("Riserva non disponibile o scaduta.");

  const sameDate = hold.date === date;
  const sameTime = hold.time === normalizeTime(time);
  const sameServices = serviceNames.every((serviceName) => hold.serviceNames.includes(serviceName));
  const sameStaff = hold.staffNames.length === 0 || hold.staffNames.includes(staffName);
  const sameLocation = (hold.locationId ?? null) === (locationId ?? null);

  if (!sameDate || !sameTime || !sameServices || !sameStaff || !sameLocation) {
    throw new Error("La riserva non corrisponde alla prenotazione da salvare.");
  }

  return hold;
}

export function markHoldConverted(token: string, appointmentId: number, ownerKey = "backend"): void {
  const hold = appointmentHoldStore().find((item) => item.token === token && item.ownerKey === ownerKey);
  if (hold) hold.convertedAppointmentId = appointmentId;
}

export function createAppointment(input: CreateAppointmentInput): AppointmentWithMeta {
  const date = input.date ?? todayIso();
  const normalizedTime = normalizeTime(input.time);
  const serviceNames = [input.serviceName];

  if (input.holdToken) {
    assertActiveHoldForSave({
      token: input.holdToken,
      date,
      time: normalizedTime,
      serviceNames,
      staffName: input.operator,
      locationId: input.locationId ?? null,
    });
  } else {
    const slot = buildSlots({
      date,
      serviceNames,
      staffName: input.operator,
      locationId: input.locationId ?? null,
      appointments: input.appointments,
    }).find((item) => item.time === normalizedTime);

    if (!slot?.available) {
      throw new Error("Orario non disponibile per l'operatore selezionato.");
    }
  }

  const nextId = input.appointments.length > 0
    ? Math.max(...input.appointments.map((appointment) => appointment.id)) + 1
    : 1;

  const appointment: AppointmentWithMeta = {
    id: nextId,
    date,
    locationId: input.locationId ?? null,
    time: normalizedTime,
    client: input.clientName.trim() || "Nuovo cliente",
    service: input.serviceName,
    operator: input.operator,
    room: roomForService(input.serviceName),
    price: servicePriceLabel(input.serviceName),
    status: "In attesa",
    holdToken: input.holdToken,
  };

  if (input.holdToken) markHoldConverted(input.holdToken, nextId);

  return appointment;
}

export function updateAppointmentStatus(
  appointments: AppointmentWithMeta[],
  id: number,
  status: AppointmentStatus | string,
): AppointmentWithMeta[] {
  const normalizedStatus = normalizeAppointmentStatus(status);

  return appointments.map((appointment) =>
    appointment.id === id ? { ...appointment, status: normalizedStatus } : appointment,
  );
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function operatorFree({
  operator,
  date,
  start,
  end,
  locationId,
  appointments,
  holds,
  excludeAppointmentId,
  excludeHoldToken,
}: {
  operator: string;
  date: string;
  start: number;
  end: number;
  locationId: number | null;
  appointments: AppointmentWithMeta[];
  holds: AppointmentHold[];
  excludeAppointmentId?: number;
  excludeHoldToken?: string;
}): boolean {
  for (const appointment of appointments) {
    if (appointment.id === excludeAppointmentId) continue;
    if (!appointmentBlocksDate(appointment, date)) continue;
    if (!appointmentBlocksLocation(appointment, locationId)) continue;
    if (appointment.operator !== operator) continue;

    const appointmentStart = timeToMinutes(appointment.time);
    const appointmentEnd = appointmentStart + serviceDurationMinutes(appointment.service);
    if (rangeOverlaps(start, end, appointmentStart, appointmentEnd)) return false;
  }

  for (const hold of holds) {
    if (hold.token === excludeHoldToken) continue;
    if (hold.date !== date) continue;
    if (!holdBlocksLocation(hold, locationId)) continue;
    if (hold.staffNames.length > 0 && !hold.staffNames.includes(operator)) continue;

    const holdStart = timeToMinutes(hold.time);
    const holdEnd = holdStart + hold.durationMinutes;
    if (rangeOverlaps(start, end, holdStart, holdEnd)) return false;
  }

  return true;
}

function appointmentBlocksDate(appointment: AppointmentWithMeta, date: string): boolean {
  return !appointment.date || appointment.date === date;
}

function appointmentBlocksLocation(appointment: AppointmentWithMeta, locationId: number | null): boolean {
  const appointmentLocationId = appointment.locationId ?? null;
  if (!locationId || !appointmentLocationId) return true;
  return appointmentLocationId === locationId;
}

function holdBlocksLocation(hold: AppointmentHold, locationId: number | null): boolean {
  if (!locationId || !hold.locationId) return true;
  return hold.locationId === locationId;
}

function roomForService(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes("manicure") || lower.includes("nails")) return "Nails bar";
  if (lower.includes("massaggio")) return "Cabina 1";
  if (lower.includes("ciglia")) return "Cabina 3";
  return "Cabina 2";
}

function randomToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `hold_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
