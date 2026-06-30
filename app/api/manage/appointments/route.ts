import {
  normalizeAppointmentStatus,
  todayIso,
} from "@/lib/appointment-engine";
import { emptyToNull, jsonError, parseRequestBody } from "@/lib/api-utils";
import {
  appointmentCustomerVisibleChanged,
  appointmentPhpStatus,
  createDbAppointment,
  deleteDbAppointment,
  getDbAppointmentCustomerVisibleSnapshot,
  getDbAppointmentForEdit,
  getDbAppointmentMoveSnapshot,
  getDbAppointmentPhpStatus,
  listDbAppointments,
  resizeDbAppointmentEnd,
  updateDbAppointment,
  updateDbAppointmentStatus,
  type AppointmentPackageRedeem,
  type AppointmentPrepaidRedeem,
  type AppointmentGiftcardRedeem,
  type AppointmentGiftboxRedeem,
  type AppointmentGiftRedeem,
} from "@/lib/db-repositories";
import { lifecycleKindForStatusChange, sendAppointmentLifecycleEmail } from "@/lib/appointment-lifecycle-email";
import { currentManageSession } from "@/lib/manage-auth";
import { resolveManageLocationId } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can, canAny } from "@/lib/role-permissions";
import {
  holdPublicBookingSlot,
  publicBookingContext,
  publicBookingSlots,
  releasePublicBookingHold,
  renewPublicBookingHold,
  type PublicBookingContext,
} from "@/lib/public-booking-db";
import { listQuickBookingCabins } from "@/lib/db-repositories";
import { getManageLocationContext } from "@/lib/manage-locations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!canAny(session.user.perms, ["calendar.view", "appointments.manage", "appointments.plan"])) return jsonError("Permesso appuntamenti mancante.", 403);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "list";

  // Quick-booking context: everything the global "Nuova prenotazione" offcanvas
  // needs to render (services grouped by category, staff, locations, cabins) in a
  // single tenant-scoped GET. Mirrors the legacy quick-booking page setup
  // (app/lib/View.php groups $services by $categories, reads $serviceLocationMap,
  // and lists staff/cabins). Reuses publicBookingContext (services with
  // categoryId/duration/price/noOperator/locationIds + categories + staff +
  // locations) and adds cabins, which that context omits.
  if (action === "context") {
    try {
      const [context, cabins, locationContext] = await Promise.all([
        publicBookingContext(tenantSlug),
        listQuickBookingCabins(tenantSlug),
        getManageLocationContext(tenantSlug),
      ]);
      return Response.json({
        ok: true,
        source: "app/lib/View.php (#quickBooking) + app/pages/api_appointments.php",
        sourceMode: "database",
        currentLocationId: locationContext.currentLocationId,
        categories: context.categories,
        services: context.services,
        staff: context.staff,
        locations: context.locations,
        cabins,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore contesto prenotazione.");
    }
  }

  // EDIT-mode load for the global quick-booking drawer (port of
  // api_appointments.php action='get', ~8594). Returns the appointment's full
  // EDITABLE payload (client, services, per-service operator/cabin maps, date/time,
  // status, notes, booking code) so the drawer can PREFILL itself. Tenant-scoped +
  // permission-gated (same view/manage/plan check as the rest of this GET). The
  // SAVE path is unchanged: the drawer re-submits action=save WITH the id, which
  // routes to updateDbAppointment.
  if (action === "get") {
    const id = Number.parseInt(String(url.searchParams.get("id") ?? "0"), 10);
    if (!Number.isFinite(id) || id <= 0) return jsonError("ID mancante", 400);
    try {
      const appointment = await getDbAppointmentForEdit(tenantSlug, id);
      if (!appointment) return jsonError("Appuntamento non trovato.", 404);
      return Response.json({
        ok: true,
        source: "app/pages/api_appointments.php?action=get",
        sourceMode: "database",
        appointment,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Errore caricamento prenotazione.");
    }
  }

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
    // RANGE list (calendar Week/Month views): when `from`/`to` (YYYY-MM-DD) are
    // sent INSTEAD of a single `date`, list every appointment whose start falls in
    // [from, to) — listDbAppointments already supports the start/end half-open
    // clause. `date` (single day) still takes priority when present (Day view).
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    return Response.json({
      ok: true,
      source: "app/pages/api_appointments.php",
      sourceMode: "database",
      appointments: await listDbAppointments(
        date ? { slug: tenantSlug, date } : { slug: tenantSlug, start: from, end: to },
      ),
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

    // DELETE — per-row "Elimina" (app/pages/appointments.php ~79-130) + bulk_delete
    // (~292-520). Deleting RESTORES every redeem the appointment consumed and removes
    // its child rows (see deleteDbAppointment). Gated on appointments.manage (the
    // legacy delete/bulk_delete is a management action), stricter than the POST
    // umbrella check above which also admits plan/quick_booking.
    if (action === "delete" || action === "bulk_delete") {
      if (!can(session.user.perms, "appointments.manage")) {
        return jsonError("Permesso eliminazione appuntamenti mancante.", 403);
      }

      // Collect the target ids. `delete` takes a single id (body/query); `bulk_delete`
      // takes `ids` as an array or a CSV string (mirrors the legacy `ids` POST field).
      const ids: number[] = [];
      const pushId = (raw: unknown) => {
        const id = Number.parseInt(String(raw).trim(), 10);
        if (Number.isFinite(id) && id > 0 && !ids.includes(id)) ids.push(id);
      };
      if (action === "delete") {
        pushId(body.id ?? url.searchParams.get("id") ?? "0");
      } else {
        const rawIds = body.ids ?? url.searchParams.get("ids") ?? "";
        if (Array.isArray(rawIds)) rawIds.forEach(pushId);
        else String(rawIds).split(",").forEach(pushId);
      }
      if (ids.length === 0) {
        return Response.json({ ok: false, error: "Nessun appuntamento selezionato." }, { status: 400 });
      }

      // Best-effort per id: a row that is not the tenant's / already gone returns
      // false and is simply not counted, mirroring the legacy tolerant bulk delete.
      let deleted = 0;
      for (const id of ids) {
        if (await deleteDbAppointment(tenantSlug, id)) deleted += 1;
      }

      return Response.json({
        ok: true,
        source: "app/pages/appointments.php?action=delete|bulk_delete",
        sourceMode: "database",
        deleted,
        appointments: await listDbAppointments({ slug: tenantSlug }),
      });
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

    // Calendar drag/move (port of api_appointments.php action='move'). A move only
    // changes the slot — new date/time and, in the staff-columns view, optionally the
    // operator (and location). Client/service/notes are preserved by re-feeding the
    // existing snapshot to updateDbAppointment, which recomputes the end from the
    // service duration (so the visible duration is preserved on a move). The legacy
    // accepts full `starts_at`/`ends_at` datetimes; we accept the same plus the
    // lighter `date`+`time`, deriving date/time from `starts_at` when only that is sent.
    if (action === "move") {
      const id = Number.parseInt(String(body.id ?? "0"), 10);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "Dati mancanti" }, { status: 400 });
      }

      // Resolve the new slot: prefer explicit date/time, else split a MySQL/ISO
      // `starts_at` ("YYYY-MM-DD HH:MM[:SS]" or with a 'T") into date + HH:MM.
      const startsAt = String(body.starts_at ?? "");
      const slot = parseStartsAt(startsAt);
      const date = String(body.date ?? slot.date ?? "");
      const time = String(body.time ?? slot.time ?? "");
      if (!date || !time) {
        return Response.json({ ok: false, error: "Data/ora non valida" }, { status: 400 });
      }

      // Tenant-scoped snapshot of the preserved fields (+ current status). A null
      // snapshot means the row is not the tenant's / does not exist.
      const snapshot = await getDbAppointmentMoveSnapshot(tenantSlug, id);
      if (!snapshot) {
        return Response.json({ ok: false, error: "Appuntamento non trovato." }, { status: 400 });
      }
      // Legacy guard: only pending/scheduled appointments are movable from the calendar.
      if (snapshot.phpStatus !== "pending" && snapshot.phpStatus !== "scheduled") {
        return Response.json({ ok: false, error: "La prenotazione non e modificabile da calendario." }, { status: 400 });
      }

      // Operator: an explicit staff_name/operator (staff-columns drag between columns)
      // overrides; an empty string clears the assignment; omitted keeps the current one.
      const hasStaffParam = body.staff_name !== undefined || body.operator !== undefined;
      const operator = hasStaffParam ? String(body.staff_name ?? body.operator ?? "") : snapshot.operator;

      // Location: an explicit location_id resolves to the tenant location; otherwise
      // keep the appointment's current location.
      const locationId = body.location_id === undefined
        ? snapshot.locationId
        : (await resolveManageLocationId({ slug: tenantSlug, raw: String(body.location_id), fallbackCurrent: true })) || null;

      const before = await getDbAppointmentCustomerVisibleSnapshot(tenantSlug, id);
      const appointment = await updateDbAppointment({
        slug: tenantSlug,
        id,
        clientName: snapshot.clientName,
        serviceName: snapshot.serviceName,
        operator,
        time,
        date,
        locationId,
        staffNotes: snapshot.staffNotes,
        customerNotes: snapshot.customerNotes,
      });

      // Fire the 'modified' email only when a customer-visible field actually changed
      // (date/time will change on a move), mirroring the save edit path. Gated +
      // error-swallowed inside the helper, so a delivery problem never fails the move.
      if (before) {
        const after = await getDbAppointmentCustomerVisibleSnapshot(tenantSlug, id);
        if (after && appointmentCustomerVisibleChanged(before, after)) {
          await sendAppointmentLifecycleEmail({ slug: tenantSlug, appointmentId: id, kind: "modified" });
        }
      }

      return Response.json({
        ok: true,
        source: "app/pages/api_appointments.php?action=move",
        sourceMode: "database",
        appointment,
        appointments: await listDbAppointments({ slug: tenantSlug }),
      });
    }

    // RESIZE (duration change, port of the calendar bottom-edge resize). Unlike
    // `move`/`save` — which route through updateDbAppointment and recompute ends_at
    // from the SERVICE duration — resize persists a CUSTOM duration: it writes the
    // dragged end time DIRECTLY (appointments.ends_at + the trailing segment's
    // ends_at), keeping the start fixed. Tenant-scoped, pending/scheduled only, and
    // reuses the same operator-overlap conflict check (resizeDbAppointmentEnd).
    if (action === "resize") {
      const id = Number.parseInt(String(body.id ?? "0"), 10);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "Dati mancanti" }, { status: 400 });
      }

      // The new end: prefer an explicit HH:MM `time`/`end_time`, else split a MySQL/
      // ISO `ends_at` ("YYYY-MM-DD HH:MM[:SS]" or with a 'T") into its HH:MM.
      const endsAt = String(body.ends_at ?? "");
      const endTime = String(body.end_time ?? body.time ?? parseStartsAt(endsAt).time ?? "");
      if (!endTime) {
        return Response.json({ ok: false, error: "Ora di fine non valida" }, { status: 400 });
      }

      const appointment = await resizeDbAppointmentEnd(tenantSlug, id, endTime);
      if (!appointment) {
        return Response.json({ ok: false, error: "Appuntamento non trovato." }, { status: 400 });
      }

      // No lifecycle email on resize: the end time is NOT part of the compact
      // customer-visible snapshot (date/time/service names), so a pure duration
      // change is never a customer-visible change — matching the move path, which
      // only emails when date/time actually move.

      return Response.json({
        ok: true,
        source: "app/pages/api_appointments.php?action=resize",
        sourceMode: "database",
        appointment,
        appointments: await listDbAppointments({ slug: tenantSlug }),
      });
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
    const operator = String(body.staff_name ?? body.operator ?? "");
    const locationId = await resolveManageLocationId({
      slug: tenantSlug,
      raw: body.location_id === undefined ? null : String(body.location_id),
      fallbackCurrent: true,
    }) || null;
    const date = String(body.date ?? todayIso());
    const holdToken = emptyToNull(String(body.appointment_hold_token ?? body.hold_token ?? ""));

    // MULTI-SERVICE: the drawer may send `service_ids` (ordered, robust) and/or
    // `service_names` (ordered array or comma-joined string), plus per-service
    // `staff_map` / `cabin_map` (serviceId -> staffId / cabinId) and an explicit
    // `cabin_id`. We prefer `service_ids` (resolving them to names against the
    // tenant context so createDbAppointment can resolve them by name as before),
    // falling back to `service_names`. When no multi-service data is present we
    // fall back to the single `service_name` (single-service path unchanged).
    const staffMap = parseIdMap(body.staff_map);
    const cabinMap = parseIdMap(body.cabin_map);
    const explicitCabinId = parseOptionalId(body.cabin_id);
    const serviceIds = parseIdList(body.service_ids);
    // Quick-booking PACKAGE redeem (#qb_package_redeem JSON array): per-service
    // requests to cover a service with the client's prepaid package. Parsed here,
    // re-validated + consumed server-side inside createDbAppointment (never trusted).
    const packageRedeems = parsePackageRedeem(body.package_redeem);
    const packageWarnings: string[] = [];
    // Quick-booking PREPAID-SERVICE redeem (#qb_prepaid_service_redeem JSON array):
    // per-service requests to cover a service with the client's prepaid-service
    // balance. Parsed here, re-validated + consumed server-side inside
    // createDbAppointment (never trusted). A service already covered by a package
    // redeem is skipped there (one service is covered once).
    const prepaidRedeems = parsePrepaidRedeem(body.prepaid_service_redeem);
    const prepaidWarnings: string[] = [];
    // Quick-booking GIFTCARD redeem (#qb_giftcard_redeem JSON array): an
    // APPOINTMENT-LEVEL request to apply the client's giftcard BALANCE (a monetary
    // amount) toward the appointment. Parsed here, re-validated + clamped + the
    // giftcard decremented server-side inside createDbAppointment (never trusted).
    const giftcardRedeems = parseGiftcardRedeem(body.giftcard_redeem);
    const giftcardWarnings: string[] = [];
    // Quick-booking GIFTBOX redeem (#qb_giftbox_redeem JSON array): per-service requests
    // to cover a service with ONE ITEM from the client's giftbox (a per-service item is
    // consumed, the service is zero-charged). Parsed here, re-validated + the redemption
    // recorded server-side inside createDbAppointment (never trusted). A service already
    // covered by a package OR prepaid redeem is skipped there (one service is covered once).
    const giftboxRedeems = parseGiftboxRedeem(body.giftbox_redeem);
    const giftboxWarnings: string[] = [];
    // Quick-booking GIFT (omaggio) redeem (#qb_gift_redeem JSON array): per-service requests
    // to cover a service with ONE REWARD from the client's gift (a service reward is a free
    // service; one reward unit is consumed, the service is zero-charged). Parsed here,
    // re-validated + the redemption recorded server-side inside createDbAppointment (never
    // trusted). A service already covered by a package, prepaid OR giftbox redeem is skipped
    // there (one service is covered once).
    const giftRedeems = parseGiftRedeem(body.gift_redeem);
    const giftWarnings: string[] = [];
    let serviceNames = parseServiceNamesFromBody(body);
    if (serviceIds.length > 0) {
      // `service_ids` is unambiguous (no comma-in-name issue) so it wins when sent.
      const context = await publicBookingContext(tenantSlug);
      serviceNames = serviceIds
        .map((id) => context.services.find((svc) => svc.id === id)?.name ?? "")
        .filter(Boolean);
      if (serviceNames.length !== serviceIds.length) throw new Error("Servizio non trovato o non prenotabile.");
    }
    // Primary service name kept for the single-service fallback (first selected).
    const serviceName = serviceNames[0] ?? String(body.service_name ?? body.service ?? "");

    const dbAppointmentInput = {
      slug: tenantSlug,
      clientName: String(body.client_name ?? body.client ?? ""),
      serviceName,
      serviceNames,
      staffMap,
      cabinMap,
      cabinId: explicitCabinId,
      operator,
      time: String(body.time ?? ""),
      date,
      locationId,
      holdToken,
      staffNotes: emptyToNull(String(body.staff_notes ?? "")),
      customerNotes: emptyToNull(String(body.customer_notes ?? body.notes ?? "")),
      // Respected on create (normalized; default pending). updateDbAppointment
      // ignores it — status edits go through action=status.
      status: body.status ? String(body.status) : undefined,
      // Manual SCONTO from the quick-booking price panel (#qb_discount_type /
      // #qb_discount_value). Threaded into create/updateDbAppointment (the appointments
      // table has discount_type/discount_value columns); each clamps it the same way the
      // drawer's recompute does. Empty type => no discount. Mirrors how `status` is threaded.
      // TODO(coupon-persist): coupon_code/coupon_discount are posted by the drawer but the
      // Next appointments table has no coupon columns yet, so they are not persisted here.
      discountType: body.discount_type ? String(body.discount_type) : undefined,
      discountValue: body.discount_value === undefined ? undefined : String(body.discount_value),
      packageRedeems,
      packageWarnings,
      prepaidRedeems,
      prepaidWarnings,
      giftcardRedeems,
      giftcardWarnings,
      giftboxRedeems,
      giftboxWarnings,
      giftRedeems,
      giftWarnings,
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
      // Per-redeem skip messages (e.g. package not covering a service / exhausted):
      // the booking still succeeds (legacy best-effort parity); the drawer may show them.
      ...(packageWarnings.length > 0 ? { packageWarnings } : {}),
      // Per-prepaid-redeem skip messages (prepaid not covering / exhausted / already
      // covered by a package): same best-effort parity; the drawer may show them.
      ...(prepaidWarnings.length > 0 ? { prepaidWarnings } : {}),
      // GiftCard-redeem skip messages (not the client's / expired / no balance /
      // nothing payable / clamped to 0): same best-effort parity; drawer may show them.
      ...(giftcardWarnings.length > 0 ? { giftcardWarnings } : {}),
      // GiftBox-redeem skip messages (not the client's / expired / item not covering /
      // exhausted / already covered by a package/prepaid): same best-effort parity.
      ...(giftboxWarnings.length > 0 ? { giftboxWarnings } : {}),
      // Gift (omaggio) redeem skip messages (not the client's / not available / expired /
      // reward not covering / exhausted / already covered by a package/prepaid/giftbox):
      // same best-effort parity; the drawer may show them.
      ...(giftWarnings.length > 0 ? { giftWarnings } : {}),
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

// Split a "starts_at" datetime ("YYYY-MM-DD HH:MM[:SS]" or "...THH:MM...") into a
// local date (YYYY-MM-DD) and HH:MM time. Used by the calendar move action so the
// legacy `starts_at` payload still works alongside the lighter date+time payload.
function parseStartsAt(value: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value.trim());
  if (!m) return { date: "", time: "" };
  return { date: m[1], time: m[2] };
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

function parseServiceNamesFromBody(body: Record<string, unknown>): string[] {
  const raw = body.service_names ?? body.service_name ?? body.service ?? "";
  // Tolerate a JSON/array of names or a comma-joined string.
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Parse an ordered list of positive integer ids from an array, a JSON string, or
// a comma-joined string ("3,7" / [3,7] / "[3,7]"). Preserves order, drops
// non-positive/duplicate ids (mirrors the legacy unique_int_list_preserve_order).
function parseIdList(raw: unknown): number[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = trimmed;
      }
    }
  }
  const parts = Array.isArray(source)
    ? source
    : String(source ?? "").split(",");
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const id = Number.parseInt(String(part).trim(), 10);
    if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// Parse a serviceId -> id map (staff_map / cabin_map). Tolerates a JSON object
// ({"3":7}), a plain object, or "sid:val" pairs joined by comma/semicolon
// ("3:7,8:2") — the shapes the legacy parse_staff_map / parse_cabin_map accept.
function parseIdMap(raw: unknown): Record<number, number> {
  const out: Record<number, number> = {};
  if (raw === null || raw === undefined || raw === "") return out;
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return out;
    if (trimmed.startsWith("{")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = trimmed;
      }
    }
    if (typeof source === "string") {
      // "sid:val" pairs separated by comma or semicolon.
      for (const pair of source.split(/[,;]/)) {
        const [k, v] = pair.split(":");
        const key = Number.parseInt(String(k ?? "").trim(), 10);
        const val = Number.parseInt(String(v ?? "").trim(), 10);
        if (Number.isFinite(key) && key > 0 && Number.isFinite(val) && val > 0) out[key] = val;
      }
      return out;
    }
  }
  if (source && typeof source === "object") {
    for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
      const key = Number.parseInt(k, 10);
      const val = Number.parseInt(String(v), 10);
      if (Number.isFinite(key) && key > 0 && Number.isFinite(val) && val > 0) out[key] = val;
    }
  }
  return out;
}

// Parse an optional positive integer id (cabin_id); returns null when absent/0.
function parseOptionalId(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const id = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// Parse the quick-booking `package_redeem` payload — a JSON array (or already an
// array) of { client_package_id, service_id, client_package_service_id? } items —
// into AppointmentPackageRedeem[]. Mirrors assets/js/app.js qbReadPackageRedeem:
// items missing a positive client_package_id or service_id are dropped, and a
// service is kept at most once (first wins) since one service is covered by one
// package. The real validation (ownership/active/coverage/sessions) happens
// server-side in applyAppointmentPackageRedeems — this only shapes the input.
function parsePackageRedeem(raw: unknown): AppointmentPackageRedeem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out: AppointmentPackageRedeem[] = [];
  const seenService = new Set<number>();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const clientPackageId = Number.parseInt(String(entry.client_package_id ?? ""), 10);
    const serviceId = Number.parseInt(String(entry.service_id ?? ""), 10);
    if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) continue;
    if (!Number.isFinite(serviceId) || serviceId <= 0) continue;
    if (seenService.has(serviceId)) continue;
    seenService.add(serviceId);
    const rawItemId = Number.parseInt(String(entry.client_package_service_id ?? ""), 10);
    out.push({
      clientPackageId,
      serviceId,
      clientPackageServiceId: Number.isFinite(rawItemId) && rawItemId > 0 ? rawItemId : null,
    });
  }
  return out;
}

// Parse the quick-booking `prepaid_service_redeem` payload — a JSON array (or
// already an array) of { client_prepaid_service_id, service_id } items — into
// AppointmentPrepaidRedeem[]. Mirrors assets/js/app.js qbReadPrepaidServiceRedeem
// (and parseRequestBody stringifies body values, so the drawer sends this as a JSON
// STRING, handled here): items missing a positive client_prepaid_service_id or
// service_id are dropped, and a service is kept at most once (first wins) since one
// service is covered by one prepaid. The real validation (ownership/active/coverage/
// remaining) happens server-side in applyAppointmentPrepaidRedeems — this only
// shapes the input. Also accepts the legacy `prepaid_service_id`/`id` aliases.
function parsePrepaidRedeem(raw: unknown): AppointmentPrepaidRedeem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out: AppointmentPrepaidRedeem[] = [];
  const seenService = new Set<number>();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const clientPrepaidServiceId = Number.parseInt(
      String(entry.client_prepaid_service_id ?? entry.prepaid_service_id ?? entry.id ?? ""),
      10,
    );
    const serviceId = Number.parseInt(String(entry.service_id ?? ""), 10);
    if (!Number.isFinite(clientPrepaidServiceId) || clientPrepaidServiceId <= 0) continue;
    if (!Number.isFinite(serviceId) || serviceId <= 0) continue;
    if (seenService.has(serviceId)) continue;
    seenService.add(serviceId);
    out.push({ clientPrepaidServiceId, serviceId });
  }
  return out;
}

// Parse the quick-booking `giftcard_redeem` payload — a JSON array (or already an
// array) of { giftcard_id, amount } items — into AppointmentGiftcardRedeem[]. Mirrors
// assets/js/app.js #qb_giftcard_redeem (and parseRequestBody stringifies body values,
// so the drawer sends this as a JSON STRING, handled here). GiftCard is
// APPOINTMENT-LEVEL + MONETARY: one giftcard, one amount (NOT per-service). Items
// missing a positive giftcard_id are dropped; the amount is coerced to a non-negative
// number (the real clamp to min(balance, payableTotal) happens server-side in
// applyAppointmentGiftcardRedeem — this only shapes the input). Also accepts the
// legacy `id` alias for the giftcard id and `used_amount`/`used` aliases for the
// amount (qbOpenGiftcardInfo passes usedAmount).
function parseGiftcardRedeem(raw: unknown): AppointmentGiftcardRedeem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out: AppointmentGiftcardRedeem[] = [];
  const seen = new Set<number>();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const giftcardId = Number.parseInt(String(entry.giftcard_id ?? entry.id ?? ""), 10);
    if (!Number.isFinite(giftcardId) || giftcardId <= 0) continue;
    if (seen.has(giftcardId)) continue; // dedupe a giftcard (one per appointment anyway)
    seen.add(giftcardId);
    const amount = Number.parseFloat(
      String(entry.amount ?? entry.used_amount ?? entry.used ?? "").replace(",", "."),
    );
    out.push({ giftcardId, amount: Number.isFinite(amount) && amount > 0 ? amount : 0 });
  }
  return out;
}

// Parse the quick-booking `giftbox_redeem` payload — a JSON array (or already an array)
// of { instance_id, giftbox_item_id, service_id } items — into AppointmentGiftboxRedeem[].
// Mirrors assets/js/app.js #qb_giftbox_redeem (and parseRequestBody stringifies body
// values, so the drawer sends this as a JSON STRING, handled here). GiftBox is per-service
// + ITEM-based: one giftbox item covers one service. Items missing a positive instance_id,
// giftbox_item_id or service_id are dropped, and a service is kept at most once (first
// wins) since one service is covered by one item. The real validation (ownership/issued/
// not expired/coverage/residual) happens server-side in applyAppointmentGiftboxRedeems —
// this only shapes the input.
function parseGiftboxRedeem(raw: unknown): AppointmentGiftboxRedeem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out: AppointmentGiftboxRedeem[] = [];
  const seenService = new Set<number>();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const instanceId = Number.parseInt(String(entry.instance_id ?? ""), 10);
    const giftboxItemId = Number.parseInt(String(entry.giftbox_item_id ?? ""), 10);
    const serviceId = Number.parseInt(String(entry.service_id ?? ""), 10);
    if (!Number.isFinite(instanceId) || instanceId <= 0) continue;
    if (!Number.isFinite(giftboxItemId) || giftboxItemId <= 0) continue;
    if (!Number.isFinite(serviceId) || serviceId <= 0) continue;
    if (seenService.has(serviceId)) continue;
    seenService.add(serviceId);
    out.push({ instanceId, giftboxItemId, serviceId });
  }
  return out;
}

// Parse the quick-booking `gift_redeem` payload — a JSON array (or already an array) of
// { instance_id, reward_item_index, service_id } items — into AppointmentGiftRedeem[].
// Mirrors assets/js/app.js #qb_gift_redeem (and parseRequestBody stringifies body values,
// so the drawer sends this as a JSON STRING, handled here). A GIFT is per-service +
// REWARD-based: one reward (a free service) covers one service. Items missing a positive
// instance_id or service_id are dropped (reward_item_index defaults to 0 when not finite,
// parity with qbReadGiftRedeem), and a service is kept at most once (first wins) since one
// service is covered by one reward. The real validation (ownership/availability/coverage/
// residual) happens server-side in applyAppointmentGiftRedeems — this only shapes the input.
function parseGiftRedeem(raw: unknown): AppointmentGiftRedeem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out: AppointmentGiftRedeem[] = [];
  const seenService = new Set<number>();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const instanceId = Number.parseInt(String(entry.instance_id ?? ""), 10);
    const serviceId = Number.parseInt(String(entry.service_id ?? ""), 10);
    const rawIndex = Number.parseInt(String(entry.reward_item_index ?? ""), 10);
    if (!Number.isFinite(instanceId) || instanceId <= 0) continue;
    if (!Number.isFinite(serviceId) || serviceId <= 0) continue;
    const rewardItemIndex = Number.isFinite(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
    if (seenService.has(serviceId)) continue;
    seenService.add(serviceId);
    out.push({ instanceId, rewardItemIndex, serviceId });
  }
  return out;
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
