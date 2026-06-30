import { todayIso } from "@/lib/appointment-engine";
import { parseRequestBody } from "@/lib/api-utils";
import {
  confirmPublicBooking,
  holdPublicBookingSlot,
  publicBookingContext,
  publicBookingSlots,
  releasePublicBookingHold,
} from "@/lib/public-booking-db";
import { upsertPublicCustomerFromBooking } from "@/lib/public-customer-account";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  const action = url.searchParams.get("action") ?? "context";

  try {
    if (!slug) throw new Error("Attivita non specificata.");

    if (action === "slots") {
      const date = url.searchParams.get("date") ?? todayIso();
      const serviceIds = parseIdList(url.searchParams.get("service_ids") ?? url.searchParams.get("services"));
      const staffId = parseOptionalId(url.searchParams.get("staff_id"));
      const locationId = parseOptionalId(url.searchParams.get("location_id"));
      const slots = await publicBookingSlots({ slug, date, serviceIds, staffId, locationId });

      return Response.json({
        ok: true,
        sourceMode: "database",
        date,
        slots,
      });
    }

    const context = await publicBookingContext(slug);

    return Response.json({
      ok: true,
      sourceMode: "database",
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
    if (!slug) throw new Error("Attivita non specificata.");

    if (action === "hold" || action === "hold_slot") {
      const date = String(body.date ?? todayIso());
      const time = String(body.time ?? "");
      const serviceIds = parseIdList(body.service_ids ?? body.services);
      const staffId = parseOptionalId(body.staff_id);
      const locationId = parseOptionalId(body.location_id);
      const ownerKey = ownerKeyForRequest(request, body.owner_key);
      // Write action: a real booking must hit the DB. On failure, surface the
      // error so the client can retry instead of confirming a reservation that
      // was never persisted.
      const hold = await holdPublicBookingSlot({ slug, date, time, serviceIds, staffId, locationId, ownerKey });

      return Response.json({
        ok: true,
        sourceMode: "database",
        hold,
      });
    }

    if (action === "release_hold") {
      const token = String(body.hold_token ?? body.appointment_hold_token ?? body.token ?? "");
      const ownerKey = ownerKeyForRequest(request, body.owner_key);
      const released = await releasePublicBookingHold({ slug, token, ownerKey });
      return Response.json({ ok: true, sourceMode: "database", released });
    }

    const benefit = parseBenefit(body.benefit_id);
    const ownerKey = ownerKeyForRequest(request, body.owner_key);
    // Write action: a real booking must hit the DB. On failure, surface the
    // error (the outer catch returns {ok:false,error}) instead of confirming a
    // fake appointment the customer would believe was booked.
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
      sourceMode: "database",
      confirmation,
      accountLinked: Boolean(linkedAccount),
    });
  } catch (error) {
    return Response.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

function normalizeSlug(value: string | null | undefined): string {
  // Multi-tenant-clean: resolve the slug from the request only. No default to a
  // specific tenant — an empty slug surfaces a clear "attivita non specificata"
  // error rather than silently serving another center's data.
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore prenotazione.";
}
