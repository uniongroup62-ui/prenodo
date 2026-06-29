import {
  normalizeAppointmentStatus,
  todayIso,
} from "@/lib/appointment-engine";
import { emptyToNull, jsonError, parseRequestBody } from "@/lib/api-utils";
import {
  appointmentCustomerVisibleChanged,
  appointmentPhpStatus,
  createDbAppointment,
  getDbAppointmentCustomerVisibleSnapshot,
  getDbAppointmentPhpStatus,
  listDbAppointments,
  updateDbAppointment,
  updateDbAppointmentStatus,
} from "@/lib/db-repositories";
import { lifecycleKindForStatusChange, sendAppointmentLifecycleEmail } from "@/lib/appointment-lifecycle-email";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { canAny } from "@/lib/role-permissions";
import {
  holdPublicBookingSlot,
  publicBookingContext,
  publicBookingSlots,
  releasePublicBookingHold,
  renewPublicBookingHold,
  type PublicBookingContext,
} from "@/lib/public-booking-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["calendar.view", "appointments.manage", "appointments.plan"])) return jsonError("Permesso appuntamenti mancante.", 403);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "list";

  if (action === "availability") {
    try {
      const date = url.searchParams.get("date") ?? todayIso();
      const serviceNames = parseServiceNames(url.searchParams);
      const staffName = emptyToNull(url.searchParams.get("staff_name") ?? url.searchParams.get("operator"));
      const locationId = await resolveManageLocationId({
        slug: tenantSlug,
        raw: url.searchParams.get("location_id"),
        fallbackCurrent: true,
      }) || null;
      const context = await publicBookingContext(tenantSlug);
      const serviceIds = resolveServiceIds(context, serviceNames);
      const staffId = resolveStaffId(context, staffName);

      return Response.json({
        ok: true,
        source: "app/pages/api_appointments.php?action=availability",
        sourceMode: "database",
        date,
        serviceNames,
        staffName,
        locationId,
        serviceIds,
        staffId,
        slots: await publicBookingSlots({ slug: tenantSlug, date, serviceIds, staffId, locationId }),
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore disponibilita appuntamenti.");
    }
  }

  try {
    const date = url.searchParams.get("date") ?? undefined;
    return Response.json({
      ok: true,
      source: "app/pages/api_appointments.php",
      sourceMode: "database",
      appointments: await listDbAppointments({ slug: tenantSlug, date }),
      holds: [],
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore appuntamenti.");
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["appointments.manage", "appointments.plan", "appointments.quick_booking"])) return jsonError("Permesso appuntamenti mancante.", 403);

  const body = await parseRequestBody(request);
  const url = new URL(request.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "save");

  try {
    if (action === "hold_availability") {
      const date = String(body.date ?? todayIso());
      const time = String(body.time ?? "");
      const serviceNames = parseServiceNamesFromBody(body);
      const staffName = emptyToNull(String(body.staff_name ?? body.operator ?? ""));
      const locationId = await resolveManageLocationId({
        slug: tenantSlug,
        raw: body.location_id === undefined ? null : String(body.location_id),
        fallbackCurrent: true,
      }) || null;
      const context = await publicBookingContext(tenantSlug);
      const serviceIds = resolveServiceIds(context, serviceNames);
      const staffId = resolveStaffId(context, staffName);
      const hold = await holdPublicBookingSlot({
        slug: tenantSlug,
        date,
        time,
        serviceIds,
        staffId,
        locationId,
        ownerKey: "manage",
      });

      return Response.json({ ok: true, source: "app/pages/api_appointments.php?action=hold_availability", sourceMode: "database", ...hold });
    }

    if (action === "release_hold") {
      const token = String(body.appointment_hold_token ?? body.token ?? "");
      const released = await releasePublicBookingHold({ slug: tenantSlug, token, ownerKey: "manage" });
      return Response.json({ ok: released, sourceMode: "database" });
    }

    if (action === "renew_hold") {
      const token = String(body.appointment_hold_token ?? body.token ?? "");
      const hold = await renewPublicBookingHold({ slug: tenantSlug, token, ownerKey: "manage" });
      return Response.json({ ok: true, sourceMode: "database", ...hold });
    }

    if (action === "status") {
      const id = Number.parseInt(String(body.id ?? "0"), 10);
      const status = normalizeAppointmentStatus(body.status);
      // Capture the prior PHP status BEFORE the write so we can map the
      // transition (pending->scheduled = 'approved', pending->canceled =
      // 'rejected') to the lifecycle email, matching the legacy PHP callers.
      const oldPhpStatus = await getDbAppointmentPhpStatus(tenantSlug, id);
      const appointment = await updateDbAppointmentStatus(tenantSlug, id, status);
      // Port of automation_send_email('approved'|'rejected', id): fire AFTER the
      // DB write, gated on emailConfigured() + the kind's toggle (all handled
      // inside the helper). Errors are swallowed there so a delivery problem
      // never fails the status API; the response shape is unchanged.
      if (oldPhpStatus) {
        const kind = lifecycleKindForStatusChange(oldPhpStatus, appointmentPhpStatus(status));
        if (kind) await sendAppointmentLifecycleEmail({ slug: tenantSlug, appointmentId: id, kind });
      }
      return Response.json({ ok: true, sourceMode: "database", appointment, appointments: await listDbAppointments({ slug: tenantSlug }) });
    }

    // save action. A positive integer `id` edits an EXISTING appointment
    // (updateDbAppointment); a missing/zero id creates a new one
    // (createDbAppointment, unchanged). On creation no lifecycle email fires
    // (legacy parity). On edit, the legacy 'modified' email
    // (automation_send_email('modified', id) via
    // automation_handle_customer_visible_change) fires AFTER a successful update
    // when a customer-visible field (date/time/service names) changed.
    const editId = Number.parseInt(String(body.id ?? "0"), 10);
    const isEdit = Number.isFinite(editId) && editId > 0;
    const serviceName = String(body.service_name ?? body.service ?? "");
    const operator = String(body.staff_name ?? body.operator ?? "");
    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: body.location_id === undefined ? null : String(body.location_id),
      fallbackCurrent: true,
    }) || null;
    const date = String(body.date ?? todayIso());
    const holdToken = emptyToNull(String(body.appointment_hold_token ?? body.hold_token ?? ""));
    const dbAppointmentInput = {
      slug: tenantSlug,
      clientName: String(body.client_name ?? body.client ?? ""),
      serviceName,
      operator,
      time: String(body.time ?? ""),
      date,
      locationId,
      holdToken,
      staffNotes: emptyToNull(String(body.staff_notes ?? "")),
      customerNotes: emptyToNull(String(body.customer_notes ?? body.notes ?? "")),
    };

    let appointment;
    if (isEdit) {
      // Snapshot the customer-visible fields BEFORE the write so we can detect a
      // customer-visible change afterwards (a null snapshot means the row is not
      // ours / does not exist — updateDbAppointment then throws the same guard).
      const before = await getDbAppointmentCustomerVisibleSnapshot(tenantSlug, editId);
      appointment = await updateDbAppointment({ ...dbAppointmentInput, id: editId });
      // Fire the 'modified' email only when a customer-visible field changed,
      // mirroring automation_handle_customer_visible_change. The helper is gated
      // on emailConfigured() + the modified toggle and swallows every error, so a
      // delivery problem never fails the save API and the response is unchanged.
      if (before) {
        const after = await getDbAppointmentCustomerVisibleSnapshot(tenantSlug, editId);
        if (after && appointmentCustomerVisibleChanged(before, after)) {
          await sendAppointmentLifecycleEmail({ slug: tenantSlug, appointmentId: editId, kind: "modified" });
        }
      }
    } else {
      appointment = await createDbAppointment(dbAppointmentInput);
    }

    return Response.json({
      ok: true,
      source: "app/pages/api_appointments.php?action=save",
      sourceMode: "database",
      appointment,
      appointments: await listDbAppointments({ slug: tenantSlug }),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore appuntamenti.",
      },
      { status: 400 },
    );
  }
}

function parseServiceNames(params: URLSearchParams): string[] {
  const serviceName = params.get("service_name") ?? params.get("service");
  const serviceNames = params.get("service_names");

  if (serviceNames) {
    return serviceNames
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [serviceName ?? ""].filter(Boolean);
}

function parseServiceNamesFromBody(body: Record<string, string>): string[] {
  const raw = body.service_names ?? body.service_name ?? body.service ?? "";
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveServiceIds(context: PublicBookingContext, serviceNames: string[]): number[] {
  const normalizedNames = serviceNames.map((name) => normalizeLookup(name)).filter(Boolean);
  const matched = context.services.filter((service) => normalizedNames.includes(normalizeLookup(service.name)));
  if (matched.length !== normalizedNames.length) throw new Error("Servizio non trovato o non prenotabile.");
  return matched.map((service) => service.id);
}

function resolveStaffId(context: PublicBookingContext, staffName: string | null): number | null {
  const normalizedName = normalizeLookup(staffName ?? "");
  if (!normalizedName) return null;
  const staff = context.staff.find((item) => normalizeLookup(item.name) === normalizedName);
  if (!staff) throw new Error("Operatore non trovato.");
  return staff.id;
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}
