import { buildSlots, todayIso } from "@/lib/appointment-engine";
import { parseRequestBody } from "@/lib/api-utils";
import { dbFirstValue } from "@/lib/db-first";
import {
  centerBySlug,
  centerServices,
  locationsByTenant,
  marketplaceCategories,
  operators,
} from "@/lib/demo-data";
import {
  confirmPublicBooking,
  holdPublicBookingSlot,
  publicBookingContext,
  publicBookingSlots,
  releasePublicBookingHold,
  type PublicBookingBenefit,
  type PublicBookingContext,
  type PublicBookingSlot,
} from "@/lib/public-booking-db";
import { upsertPublicCustomerFromBooking } from "@/lib/public-customer-account";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  const action = url.searchParams.get("action") ?? "context";

  try {
    if (action === "slots") {
      const date = url.searchParams.get("date") ?? todayIso();
      const serviceIds = parseIdList(url.searchParams.get("service_ids") ?? url.searchParams.get("services"));
      const staffId = parseOptionalId(url.searchParams.get("staff_id"));
      const locationId = parseOptionalId(url.searchParams.get("location_id"));
      const { value: slots, sourceMode } = await dbFirstValue(
        () => publicBookingSlots({ slug, date, serviceIds, staffId, locationId }),
        () => demoSlots({ date, serviceIds }),
      );

      return Response.json({
        ok: true,
        source: "app/pages/booking.php?mode=slots",
        sourceMode,
        date,
        slots,
      });
    }

    const { value: context, sourceMode } = await dbFirstValue(
      () => publicBookingContext(slug),
      () => demoContext(slug),
    );

    return Response.json({
      ok: true,
      source: "app/pages/booking.php",
      sourceMode,
      context,
    });
  } catch (error) {
    return Response.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const slug = normalizeSlug(body.slug ?? url.searchParams.get("slug"));
  const action = String(body.action ?? url.searchParams.get("action") ?? "confirm");

  try {
    if (action === "hold" || action === "hold_slot") {
      const date = String(body.date ?? todayIso());
      const time = String(body.time ?? "");
      const serviceIds = parseIdList(body.service_ids ?? body.services);
      const staffId = parseOptionalId(body.staff_id);
      const locationId = parseOptionalId(body.location_id);
      const ownerKey = ownerKeyForRequest(request, body.owner_key);
      // Write action: never fake a hold on a DB failure — surface the error so
      // the client can retry (a fake demo hold would let confirm "succeed" with
      // no real reservation).
      const hold = await holdPublicBookingSlot({ slug, date, time, serviceIds, staffId, locationId, ownerKey });

      return Response.json({
        ok: true,
        source: "app/pages/booking.php?mode=hold_slot",
        sourceMode: "database",
        hold,
      });
    }

    if (action === "release_hold") {
      const token = String(body.hold_token ?? body.appointment_hold_token ?? body.token ?? "");
      const ownerKey = ownerKeyForRequest(request, body.owner_key);
      const { value: released, sourceMode } = await dbFirstValue(
        () => releasePublicBookingHold({ slug, token, ownerKey }),
        () => true,
      );
      return Response.json({ ok: true, sourceMode, released });
    }

    const benefit = parseBenefit(body.benefit_id);
    const ownerKey = ownerKeyForRequest(request, body.owner_key);
    // Write action: a real booking must hit the DB. On failure, surface the
    // error (the outer catch returns {ok:false,error}) instead of confirming a
    // fake demo appointment the customer would believe was booked.
    const confirmation = await confirmPublicBooking({
      slug,
      date: String(body.date ?? todayIso()),
      time: String(body.time ?? ""),
      serviceIds: parseIdList(body.service_ids ?? body.services),
      staffId: parseOptionalId(body.staff_id),
      locationId: parseOptionalId(body.location_id),
      ownerKey,
      holdToken: String(body.hold_token ?? body.appointment_hold_token ?? "") || null,
      clientName: String(body.client_name ?? body.customer_name ?? ""),
      clientEmail: String(body.client_email ?? body.email ?? ""),
      clientPhone: String(body.client_phone ?? body.phone ?? ""),
      couponCode: String(body.coupon_code ?? benefit.couponCode ?? ""),
      promotionId: parseOptionalId(body.promotion_id) ?? benefit.promotionId,
      notes: String(body.notes ?? ""),
    });
    const linkedAccount = await upsertPublicCustomerFromBooking({
      tenantSlug: slug,
      clientId: confirmation.clientId,
      email: String(body.client_email ?? body.email ?? ""),
      fullName: String(body.client_name ?? body.customer_name ?? ""),
      phone: String(body.client_phone ?? body.phone ?? ""),
    }).catch(() => null);

    return Response.json({
      ok: true,
      source: "app/pages/booking.php?mode=confirm",
      sourceMode: "database",
      confirmation,
      accountLinked: Boolean(linkedAccount),
    });
  } catch (error) {
    return Response.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

function demoContext(slug: string): PublicBookingContext {
  const center = centerBySlug(slug) ?? centerBySlug("centroesteticoelite")!;
  const locations = locationsByTenant(center.slug);
  const categories = marketplaceCategories.map((name, index) => ({ id: index + 1, name }));
  return {
    business: {
      name: center.name,
      about: center.category,
      email: "info@example.it",
      phone: locations[0]?.phone ?? "",
      website: "",
    },
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      address: [location.address, location.city].filter(Boolean).join(", "),
      email: "",
      phone: location.phone,
      bookingEnabled: location.bookingEnabled,
      hoursToday: location.hoursToday,
    })),
    categories,
    services: centerServices.map((service, index) => ({
      id: index + 1,
      name: service.name,
      description: service.description,
      categoryId: categories[index % categories.length]?.id ?? 1,
      duration: parseMinutes(service.duration),
      price: parseMoney(service.price),
      noOperator: false,
      locationIds: locations.map((location) => location.id),
    })),
    staff: operators.map((name, index) => ({
      id: index + 1,
      name,
      serviceIds: centerServices.map((_, serviceIndex) => serviceIndex + 1),
      active: true,
    })),
    benefits: demoBenefits(),
    today: todayIso(),
  };
}

function demoSlots({ date, serviceIds }: { date: string; serviceIds: number[] }): PublicBookingSlot[] {
  const services = centerServices.filter((_, index) => serviceIds.includes(index + 1));
  return buildSlots({
    date,
    serviceNames: services.length ? services.map((service) => service.name) : [centerServices[0].name],
    stepMinutes: 30,
  }).slice(0, 12).map((slot) => ({
    time: slot.time,
    available: slot.available,
    staffId: slot.operator ? operators.indexOf(slot.operator) + 1 || null : null,
    staffName: slot.operator ?? "",
    reason: slot.reason,
  }));
}

function demoBenefits(): PublicBookingBenefit[] {
  return [
    {
      id: "coupon:demo",
      type: "coupon",
      label: "WELCOME10",
      detail: "10% di sconto",
      code: "WELCOME10",
      discountType: "percent",
      discountValue: 10,
    },
  ];
}

function normalizeSlug(value: string | null | undefined): string {
  const slug = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return slug || "centroesteticoelite";
}

function parseIdList(value: unknown): number[] {
  return String(value ?? "")
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => item > 0);
}

function parseOptionalId(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBenefit(value: unknown): { couponCode?: string; promotionId?: number } {
  const raw = String(value ?? "");
  if (raw.startsWith("coupon:") && raw !== "coupon:demo") return {};
  if (raw.startsWith("promotion:")) return { promotionId: parseOptionalId(raw.split(":")[1]) ?? undefined };
  return {};
}

function ownerKeyForRequest(request: Request, value: unknown): string {
  const explicit = String(value ?? "").trim();
  if (explicit) return explicit.slice(0, 120);
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "public";
  const agent = request.headers.get("user-agent") ?? "browser";
  return `${ip}:${agent}`.slice(0, 120);
}

function parseMinutes(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 30;
}

function parseMoney(value: string): number {
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore prenotazione.";
}
