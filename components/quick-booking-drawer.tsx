"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Faithful port of the GLOBAL "Nuova prenotazione" quick-booking offcanvas drawer
// from the legacy PHP gestionale (app/lib/View.php lines ~1094-1620: the
// `#quickBooking` `offcanvas offcanvas-end` + the `#qbClientCreateModal`). The
// markup is reproduced VERBATIM as JSX — same classes/ids/structure — so the
// existing qb-* / .qb-multiselect / .qb-ms-* styles in /assets/css/app.css
// (already loaded by manage-shell.tsx) make it look identical to the legacy.
//
// Opening: ANY [data-qb-new] click (the topbar "+ Prenotazione" button carries
// data-qb-new="1") opens THIS offcanvas IN PLACE via
// bootstrap.Offcanvas.getOrCreateInstance(#quickBooking).show() — no navigation.
//
// Wired CORE flow (port of assets/js/app.js):
//   - data-qb-new open -> reset form, default date = today, default start time
//     rounded to the next 5-min step, open offcanvas.
//   - SERVICES multiselect (#qb_ms_*): open/close dropdown, search filter by
//     data-name, location filter by data-location-ids, pills add/remove on
//     checkbox toggle, total-duration -> auto end time (syncEnd).
//   - CLIENT find (#qbLinkFindClient) and new (#qbLinkNewClient): the find UI
//     searches /api/manage/clients?q=, the new UI posts /api/manage/clients
//     action=create; the chosen/created client fills #qbSelectedClientBox and
//     #qb_client_id.
//   - Availability ([Disponibilita]) -> POST /api/manage/appointments
//     action=hold_availability; fills start/end + hold token.
//   - Submit ("Crea prenotazione") -> POST /api/manage/appointments action=save.
//
// MULTI-SERVICE: submit now sends ALL selected services (service_ids +
// service_names, ordered) so the save route persists them as sequential
// segments (each with the chosen operator/cabin). The per-service staff/cabin
// PICKER UI (#qbMultiStaffPicker) is still TODO — the hidden #qb_staff_map /
// #qb_cabin_map are forwarded as-is so a future picker that fills them works,
// but today the single operator + cabin select drive every segment.
//
// TODO (deep wiring left out, matches the SCOPE note): the redeem flows
// (giftbox/gift/package/prepaid/giftcard), client history/residuals/card panels,
// the per-service staff/cabin picker + the multi-service summary, the
// price-details / coupon / fidelity / discount block, hold countdown/renewal,
// and edit/delete of an existing appointment. Their markup is present but the
// deep logic depends on many sub-APIs that do not yet exist in the Next manage app.

type QbCategory = { id: number; name: string };
type QbService = {
  id: number;
  name: string;
  categoryId: number | null;
  duration: number;
  price: number;
  noOperator: boolean;
  locationIds: number[];
};
type QbStaff = { id: number; name: string; serviceIds: number[]; active: boolean };
type QbLocation = { id: number; name: string };
type QbCabin = { id: number; name: string; locationId: number | null };

type QbContext = {
  ok?: boolean;
  currentLocationId?: number;
  categories?: QbCategory[];
  services?: QbService[];
  staff?: QbStaff[];
  locations?: QbLocation[];
  cabins?: QbCabin[];
};

type QbClient = { id: string; full_name: string; email: string; phone: string };

// Minimal Bootstrap offcanvas/modal surface used here (the bundle is loaded by
// manage-shell.tsx). Degrades to a no-op when bootstrap is not yet present.
type BootstrapInstance = { show: () => void; hide: () => void };
type BootstrapApi = { getOrCreateInstance: (el: Element) => BootstrapInstance };
function bootstrap(): { Offcanvas?: BootstrapApi; Modal?: BootstrapApi } | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { bootstrap?: { Offcanvas?: BootstrapApi; Modal?: BootstrapApi } }).bootstrap ?? null;
}

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Round "now" up to the next 5-minute step, like app.js's default start time.
function nextStepTime(): string {
  const d = new Date();
  let min = d.getHours() * 60 + d.getMinutes();
  min = Math.ceil(min / 5) * 5;
  if (min >= 24 * 60) min = 24 * 60 - 5;
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function timeToMin(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minToTime(min: number): string {
  const clamped = Math.max(0, Math.min(min, 24 * 60 - 1));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function lower(value: string): string {
  return value.trim().toLowerCase();
}

export function QuickBookingDrawer() {
  const slug = useMemo(() => tenantSlug(), []);

  // ---- Context data (services grouped by category, staff, locations, cabins) ----
  const [ctx, setCtx] = useState<QbContext>({});
  const ctxLoadedRef = useRef(false);

  // ---- Selected client (#qb_client_id + #qbSelectedClientBox) ----
  const [client, setClient] = useState<QbClient | null>(null);

  // ---- Services multiselect state ----
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [msOpen, setMsOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");

  // ---- Date / time / location / cabin / status / notes ----
  const [date, setDate] = useState<string>(() => todayIso());
  const [startTime, setStartTime] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [cabinId, setCabinId] = useState<string>("");
  const [status, setStatus] = useState<string>("scheduled");
  const [staffId, setStaffId] = useState<string>("");
  const [staffNotes, setStaffNotes] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [holdToken, setHoldToken] = useState<string>("");

  // ---- Find-client modal state ----
  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<QbClient[]>([]);
  const findTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- New-client modal state ----
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const createFormRef = useRef<HTMLFormElement | null>(null);

  // ---- Submit / availability feedback ----
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);

  // Memoized derived context arrays (stable references for the hooks below).
  const services = useMemo(() => ctx.services ?? [], [ctx.services]);
  const categories = useMemo(() => ctx.categories ?? [], [ctx.categories]);
  const staff = useMemo(() => (ctx.staff ?? []).filter((s) => s.name.trim().toUpperCase() !== "SSO"), [ctx.staff]);
  const locations = useMemo(() => ctx.locations ?? [], [ctx.locations]);
  const cabins = useMemo(() => ctx.cabins ?? [], [ctx.cabins]);

  // Load the quick-booking context once (lazily, the first time the drawer is
  // opened) from the manage GET. Tenant-scoped via slug query + header.
  const loadContext = useCallback(() => {
    if (ctxLoadedRef.current || !slug) return;
    ctxLoadedRef.current = true;
    const params = new URLSearchParams({ slug, action: "context" });
    fetch(`/api/manage/appointments?${params.toString()}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: QbContext) => {
        setCtx(j ?? {});
        if (j?.currentLocationId && j.currentLocationId > 0) setLocationId(String(j.currentLocationId));
      })
      .catch(() => {
        ctxLoadedRef.current = false; // allow a retry on next open
        setCtx({});
      });
  }, [slug]);

  // Reset the whole form to "new appointment" defaults (port of qbResetForm).
  const resetForm = useCallback(() => {
    setClient(null);
    setSelectedServiceIds([]);
    setMsOpen(false);
    setServiceSearch("");
    setDate(todayIso());
    setStartTime(nextStepTime());
    setCabinId("");
    setStatus("scheduled");
    setStaffId("");
    setStaffNotes("");
    setCustomerNotes("");
    setHoldToken("");
    setFormError("");
    setFindQuery("");
    setFindResults([]);
    setLocationId((prev) => prev || (ctx.currentLocationId ? String(ctx.currentLocationId) : ""));
  }, [ctx.currentLocationId]);

  // GLOBAL open wiring: ANY [data-qb-new] click opens THIS offcanvas in place.
  // Listener is delegated on document so it works for buttons rendered anywhere
  // (the topbar "+ Prenotazione" button carries data-qb-new="1"). The
  // hidden.bs.offcanvas listener resets the form on close (port of app.js).
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest("[data-qb-new]");
      if (!btn) return;
      e.preventDefault();
      loadContext();
      resetForm();
      const el = document.getElementById("quickBooking");
      const api = bootstrap()?.Offcanvas;
      if (el && api) api.getOrCreateInstance(el).show();
    };

    const el = document.getElementById("quickBooking");
    const onHidden = () => {
      setHoldToken("");
      resetForm();
    };

    document.addEventListener("click", onDocClick);
    el?.addEventListener("hidden.bs.offcanvas", onHidden);
    return () => {
      document.removeEventListener("click", onDocClick);
      el?.removeEventListener("hidden.bs.offcanvas", onHidden);
    };
  }, [loadContext, resetForm]);

  const closeOffcanvas = useCallback(() => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("quickBooking");
    const api = bootstrap()?.Offcanvas;
    if (el && api) api.getOrCreateInstance(el).hide();
  }, []);

  // ---- Services: derived selected set + total duration -> end time (syncEnd) ----
  const totalDuration = useMemo(
    () => selectedServiceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.duration ?? 0), 0),
    [selectedServiceIds, services],
  );

  // syncEnd: the visible end time is DERIVED from start + total duration (no
  // effect/state needed). Mirrors app.js syncEnd().
  const endTime = useMemo(() => {
    const startMin = timeToMin(startTime);
    if (startMin === null || totalDuration <= 0) return "";
    return minToTime(startMin + totalDuration);
  }, [startTime, totalDuration]);

  // Changing services / location / date / start time invalidates any held slot
  // (port of qbReleaseAvailabilityHold). We drop the token locally inside the
  // setters rather than in an effect (avoids a cascading-render setState).
  const toggleService = useCallback((id: number) => {
    setHoldToken("");
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const changeDate = useCallback((value: string) => {
    setHoldToken("");
    setDate(value);
  }, []);
  const changeStartTime = useCallback((value: string) => {
    setHoldToken("");
    setStartTime(value);
  }, []);
  const changeLocation = useCallback((value: string) => {
    setHoldToken("");
    setLocationId(value);
  }, []);

  // Location filter for a service item (port of qbServiceItemAllowedForLocation).
  const serviceAllowedForLocation = useCallback(
    (svc: QbService): boolean => {
      const locId = Number(locationId) || 0;
      if (!locId) return true;
      if (!svc.locationIds.length) return true;
      return svc.locationIds.includes(locId);
    },
    [locationId],
  );

  // Group services by category for the dropdown (port of the PHP $byCat grouping:
  // categories first, "Senza categoria" last).
  const groupedServices = useMemo(() => {
    const byCat = new Map<number, QbService[]>();
    for (const svc of services) {
      const cid = svc.categoryId ?? 0;
      if (!byCat.has(cid)) byCat.set(cid, []);
      byCat.get(cid)!.push(svc);
    }
    const catName = new Map<number, string>([[0, "Senza categoria"]]);
    for (const c of categories) catName.set(c.id, c.name);
    const order = Array.from(catName.keys()).filter((id) => id !== 0);
    order.push(0);
    return order
      .map((cid) => ({ cid, name: catName.get(cid) ?? "Categoria", items: byCat.get(cid) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [services, categories]);

  const needle = lower(serviceSearch);

  // ---- Find client (debounced search of /api/manage/clients?q=) ----
  // Driven from the search input's onChange (not an effect) so it doesn't call
  // setState synchronously inside an effect body. 200ms debounce (port of app.js).
  const onFindQueryChange = useCallback(
    (value: string) => {
      setFindQuery(value);
      if (findTimerRef.current) clearTimeout(findTimerRef.current);
      const q = value.trim();
      if (!q) {
        setFindResults([]);
        return;
      }
      findTimerRef.current = setTimeout(() => {
        const params = new URLSearchParams({ slug, q });
        fetch(`/api/manage/clients?${params.toString()}`, { headers: { "x-tenant-slug": slug } })
          .then((r) => r.json())
          .then((j: { clients?: Array<{ id: number; name: string; email?: string; phone?: string }> }) => {
            setFindResults(
              (j.clients ?? []).slice(0, 20).map((c) => ({
                id: String(c.id),
                full_name: c.name ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
              })),
            );
          })
          .catch(() => setFindResults([]));
      }, 200);
    },
    [slug],
  );

  const selectClient = useCallback((c: QbClient) => {
    setClient(c);
    const el = document.getElementById("qbClientFindModal");
    const api = bootstrap()?.Modal;
    if (el && api) api.getOrCreateInstance(el).hide();
  }, []);

  const openFindClient = useCallback(() => {
    setFindQuery("");
    setFindResults([]);
    const el = document.getElementById("qbClientFindModal");
    const api = bootstrap()?.Modal;
    if (el && api) api.getOrCreateInstance(el).show();
  }, []);

  const openNewClient = useCallback(() => {
    setCreateError("");
    setCreateSaving(false);
    createFormRef.current?.reset();
    const el = document.getElementById("qbClientCreateModal");
    const api = bootstrap()?.Modal;
    if (el && api) api.getOrCreateInstance(el).show();
  }, []);

  // Create a new client (port of qbSubmitClientCreate). Posts to the existing
  // manage clients route (action=create); on success it becomes the selected
  // client. We send name (first+last), email, phone and location_id.
  const submitNewClient = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const first = String(fd.get("first_name") ?? "").trim();
      const last = String(fd.get("last_name") ?? "").trim();
      const name = `${first} ${last}`.trim();
      if (!name) {
        setCreateError("Nome e cognome obbligatori.");
        return;
      }
      setCreateError("");
      setCreateSaving(true);
      try {
        const res = await fetch(`/api/manage/clients?slug=${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
          body: JSON.stringify({
            action: "create",
            name,
            email: String(fd.get("email") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            location_id: String(fd.get("location_id") ?? ""),
            note: String(fd.get("notes") ?? ""),
          }),
        });
        const data: { ok?: boolean; error?: string; client?: { id: number; name: string; email?: string; phone?: string } } =
          await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false || !data.client) {
          setCreateError(String(data.error || "Errore creazione cliente."));
          return;
        }
        selectClient({
          id: String(data.client.id),
          full_name: data.client.name ?? name,
          email: data.client.email ?? String(fd.get("email") ?? ""),
          phone: data.client.phone ?? String(fd.get("phone") ?? ""),
        });
        const el = document.getElementById("qbClientCreateModal");
        const api = bootstrap()?.Modal;
        if (el && api) api.getOrCreateInstance(el).hide();
      } catch {
        setCreateError("Errore di rete durante la creazione del cliente.");
      } finally {
        setCreateSaving(false);
      }
    },
    [slug, selectClient],
  );

  // ---- Availability ([Disponibilita] -> action=hold_availability) ----
  const selectedServiceNames = useCallback(
    () => selectedServiceIds.map((id) => services.find((s) => s.id === id)?.name ?? "").filter(Boolean),
    [selectedServiceIds, services],
  );

  const runAvailability = useCallback(async () => {
    setFormError("");
    const names = selectedServiceNames();
    if (!names.length || !date || !startTime) {
      setFormError("Seleziona prima servizio, data e ora.");
      return;
    }
    setAvailLoading(true);
    try {
      const staffName = staffId ? staff.find((s) => String(s.id) === staffId)?.name ?? "" : "";
      const res = await fetch(`/api/manage/appointments?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({
          action: "hold_availability",
          date,
          time: startTime,
          service_names: names.join(","),
          staff_name: staffName,
          location_id: locationId,
        }),
      });
      const data: { ok?: boolean; error?: string; token?: string; time?: string; staffName?: string; staffId?: number | null } =
        await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false || !data.token) {
        setFormError(String(data.error || "Orario non piu disponibile. Scegli un altro slot."));
        return;
      }
      setHoldToken(data.token);
      if (data.time) setStartTime(data.time);
      // Auto-assign the operator the hold resolved (when none was chosen).
      if (!staffId && data.staffId && data.staffId > 0) setStaffId(String(data.staffId));
      // TODO(cabin/staff maps): the hold also returns cabin/segment allocations
      // (#qb_cabin_id / #qb_staff_map / #qb_cabin_map). The manage save route does
      // not yet consume per-service maps, so they are left unwired here.
    } catch {
      setFormError("Errore di rete durante il controllo disponibilita.");
    } finally {
      setAvailLoading(false);
    }
  }, [selectedServiceNames, date, startTime, staffId, staff, slug, locationId]);

  // ---- Submit ("Crea prenotazione" -> action=save) ----
  const submitBooking = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError("");
      const names = selectedServiceNames();
      if (!client) {
        setFormError("Seleziona o crea un cliente.");
        return;
      }
      if (!names.length) {
        setFormError("Seleziona almeno un servizio.");
        return;
      }
      if (!date || !startTime) {
        setFormError("Inserisci data e orario.");
        return;
      }
      setSubmitting(true);
      try {
        const staffName = staffId ? staff.find((s) => String(s.id) === staffId)?.name ?? "" : "";
        // MULTI-SERVICE: send ALL selected service names (ordered) so the save
        // route lays them out as sequential segments. The whole-appointment
        // operator (`staff_name`) applies to every segment and the explicit
        // cabin (`cabin_id`) is the primary cabin. The per-service maps
        // (#qb_staff_map / #qb_cabin_map) are read straight from the hidden
        // inputs and forwarded as JSON so a future per-service picker that
        // fills them keeps working — today the drawer leaves them empty and the
        // single operator/cabin above drive every segment.
        // TODO(per-service maps UI): wire #qbMultiStaffPicker so the staff/cabin
        // maps are populated per service (cross-segment availability holds,
        // redemptions, discounts also still TODO).
        const staffMapRaw = (document.getElementById("qb_staff_map") as HTMLInputElement | null)?.value ?? "";
        const cabinMapRaw = (document.getElementById("qb_cabin_map") as HTMLInputElement | null)?.value ?? "";
        const res = await fetch(`/api/manage/appointments?slug=${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
          body: JSON.stringify({
            action: "save",
            client_name: client.full_name,
            // Send ids (robust, ordered) AND names (the route prefers ids).
            service_ids: selectedServiceIds.join(","),
            service_names: names,
            staff_name: staffName,
            staff_map: staffMapRaw,
            cabin_map: cabinMapRaw,
            cabin_id: cabinId,
            date,
            time: startTime,
            location_id: locationId,
            staff_notes: staffNotes,
            customer_notes: customerNotes,
            appointment_hold_token: holdToken,
          }),
        });
        const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false || data.error) {
          setFormError(String(data.error || "Errore salvataggio."));
          return;
        }
        closeOffcanvas();
        // Refresh the page so any calendar/list on screen shows the new booking,
        // matching the legacy reload-on-save behavior.
        if (typeof window !== "undefined") window.location.reload();
      } catch {
        setFormError("Errore di rete durante il salvataggio.");
      } finally {
        setSubmitting(false);
      }
    },
    [client, selectedServiceIds, selectedServiceNames, date, startTime, staffId, staff, slug, locationId, cabinId, staffNotes, customerNotes, holdToken, closeOffcanvas],
  );

  const canQuickCreateClient = true; // Quick-create is always offered (legacy gates on a permission).
  const startGateDisabled = selectedServiceIds.length === 0;

  return (
    <>
      {/* ===================== OFFCANVAS (verbatim from View.php) ===================== */}
      <div className="offcanvas offcanvas-end" tabIndex={-1} id="quickBooking" aria-labelledby="quickBookingLabel">
        <div className="offcanvas-header">
          <div>
            <div className="small-muted">Agenda</div>
            <h5 className="offcanvas-title fw-bold" id="quickBookingLabel">Nuova prenotazione</h5>
            <div id="qbBookingCodeRow" className="small text-muted mt-1" style={{ display: "none" }}>
              Codice prenotazione: <code id="qbBookingCode" />
            </div>
            <div id="qbExpiredLinkedAlert" className="alert alert-warning small py-2 px-2 mt-2 mb-0" style={{ display: "none" }} />
          </div>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Chiudi" />
        </div>
        <div className="offcanvas-body">
          <div id="qbLoadingState" className="qb-loading-state" role="status" aria-live="polite" hidden>
            <div className="spinner-border text-primary" aria-hidden="true" />
            <div className="fw-semibold mt-3" id="qbLoadingText">Caricamento prenotazione...</div>
            <div className="small text-muted mt-1">Preparo dati, orari e prezzi.</div>
          </div>

          <div id="qbLoadErrorState" className="alert alert-danger qb-load-error" role="alert" hidden>
            <div className="fw-semibold mb-1">Prenotazione non caricata</div>
            <div className="small" id="qbLoadErrorText">Impossibile caricare la prenotazione.</div>
            <button type="button" className="btn btn-sm btn-outline-danger mt-2" id="qbLoadRetryBtn">Riprova</button>
          </div>

          <form id="quickBookingForm" onSubmit={submitBooking}>
            <div id="qbSegmentViewAlert" className="alert alert-warning small" style={{ display: "none" }} />
            <div id="qbCancellationAlert" className="alert alert-warning small" style={{ display: "none" }} />

            {/* Cliente (spostato sopra a "Servizi") */}
            <label className="form-label">Cliente</label>

            <input type="hidden" name="client_id" id="qb_client_id" value={client?.id ?? ""} readOnly />
            <input type="hidden" name="id" id="qb_appt_id" value="" readOnly />
            <input type="hidden" name="giftbox_redeem" id="qb_giftbox_redeem" value="" readOnly />
            <input type="hidden" name="gift_redeem" id="qb_gift_redeem" value="" readOnly />
            <input type="hidden" name="package_redeem" id="qb_package_redeem" value="" readOnly />
            <input type="hidden" name="prepaid_service_redeem" id="qb_prepaid_service_redeem" value="" readOnly />
            <input type="hidden" name="giftcard_redeem" id="qb_giftcard_redeem" value="" readOnly />

            <div id="qbSelectedClientBox" className="card p-2 mb-2" style={{ display: client ? "block" : "none" }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold" id="qbSelName">{client?.full_name ?? ""}</div>
                  <div className="small text-muted">Email: <span id="qbSelEmail">{client?.email || "—"}</span></div>
                  <div className="small text-muted">Telefono: <span id="qbSelPhone">{client?.phone || "—"}</span></div>
                </div>
                <a
                  href="#"
                  id="qbClearSelectedClient"
                  className="small text-decoration-none text-danger"
                  onClick={(e) => {
                    e.preventDefault();
                    setClient(null);
                  }}
                >
                  annulla
                </a>
              </div>
            </div>

            {/* Storico cliente (quick booking) — TODO: depends on client-history API */}
            <div id="qbClientHistoryBox" className="card p-2 mb-2" style={{ display: "none" }}>
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Storico cliente</div>
                <a href="#" id="qbClientHistoryOpen" className="small text-decoration-none">Apri scheda</a>
              </div>
              <div className="small text-muted mt-1" id="qbClientHistorySummary" />
            </div>

            {/* Residui (quick booking) — TODO: depends on residuals/giftcard/credit APIs */}
            <div id="qbClientResidualsBox" className="card p-2 mb-2" style={{ display: "none" }}>
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Residui</div>
                <a href="#" id="qbClientResidualsOpen" className="small text-decoration-none">Apri scheda</a>
              </div>
              <div className="small mt-2" id="qbClientResidualsList" />
            </div>

            <div id="qbNewClientBox" className="qb-client-actions mb-3">
              <div className="row g-2">
                <div className={canQuickCreateClient ? "col-6" : "col-12"}>
                  <button type="button" className="btn btn-outline-primary w-100" id="qbLinkFindClient" onClick={openFindClient}>
                    <i className="bi bi-search me-1" />Trova
                  </button>
                </div>
                {canQuickCreateClient ? (
                  <div className="col-6">
                    <button type="button" className="btn btn-primary w-100" id="qbLinkNewClient" onClick={openNewClient}>
                      <i className="bi bi-plus-lg me-1" />Nuovo
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <hr className="my-3" />

            <div className="mb-3">
              <label className="form-label">Servizi</label>

              <div className="qb-multiselect" id="qb_services_ms">
                <div
                  className="qb-ms-control form-control"
                  id="qb_ms_control"
                  role="button"
                  tabIndex={0}
                  aria-haspopup="listbox"
                  aria-expanded={msOpen}
                  onClick={() => setMsOpen((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMsOpen((v) => !v);
                    }
                  }}
                >
                  <div className="qb-ms-pills" id="qb_ms_pills">
                    {selectedServiceIds.map((id) => {
                      const svc = services.find((s) => s.id === id);
                      if (!svc) return null;
                      return (
                        <span
                          key={id}
                          className="badge bg-primary d-inline-flex align-items-center me-1 mb-1 qb-ms-pill"
                          data-service-id={id}
                        >
                          {svc.name}
                          <button
                            type="button"
                            className="btn-close btn-close-white ms-2"
                            aria-label="Rimuovi"
                            data-remove-id={id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleService(id);
                            }}
                          />
                        </span>
                      );
                    })}
                  </div>
                  <div
                    className="qb-ms-placeholder text-muted"
                    id="qb_ms_placeholder"
                    hidden={selectedServiceIds.length > 0}
                  >
                    Seleziona uno o più servizi…
                  </div>
                  <div className="qb-ms-caret"><i className="bi bi-chevron-down" /></div>
                </div>

                <div className="qb-ms-dropdown shadow-sm" id="qb_ms_dropdown" hidden={!msOpen}>
                  <div className="p-2 border-bottom">
                    <input
                      className="form-control"
                      id="qb_service_search"
                      type="text"
                      placeholder="Inizia a digitare per filtrare..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                    />
                  </div>
                  <div className="qb-ms-list" id="qb_ms_list" role="listbox">
                    {groupedServices.map((group) => {
                      const visibleItems = group.items.filter((svc) => {
                        const checked = selectedServiceIds.includes(svc.id);
                        const locationOk = serviceAllowedForLocation(svc);
                        const matchesSearch = needle ? lower(svc.name).includes(needle) : true;
                        return !((!locationOk && !checked) || !matchesSearch);
                      });
                      if (!visibleItems.length) return null;
                      return (
                        <div className="qb-ms-group" data-group={String(group.cid)} key={group.cid}>
                          <div className="qb-ms-group-title">{group.name}</div>
                          {visibleItems.map((svc) => (
                            <label
                              className="qb-ms-item"
                              key={svc.id}
                              data-name={lower(svc.name)}
                              data-location-ids={svc.locationIds.join(",")}
                            >
                              <input
                                className="form-check-input qb-ms-check qb_service_check me-2"
                                type="checkbox"
                                value={svc.id}
                                data-id={svc.id}
                                data-dur={svc.duration}
                                data-price={svc.price}
                                data-noop={svc.noOperator ? 1 : 0}
                                data-location-ids={svc.locationIds.join(",")}
                                data-name={svc.name}
                                checked={selectedServiceIds.includes(svc.id)}
                                onChange={() => toggleService(svc.id)}
                              />
                              <span className="qb-ms-item-name">{svc.name}</span>
                              <span className="qb-ms-item-meta text-muted small ms-1">• {svc.duration} min</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div id="qb_service_ids_container" />
              <div className="form-text">Seleziona i servizi dal menu: puoi cercare, scegliere più servizi e la durata verrà calcolata automaticamente.</div>
            </div>

            <div className="row g-2">
              <div className="col-12">
                <label className="form-label">Operatore</label>
                {/* Multi-servizio: la select non rappresenta univocamente l'assegnazione. */}
                <div id="qbStaffSummaryBox" className="form-control" style={{ display: "none", background: "#f8fafc" }} />
                <div id="qbStaffSummaryHint" className="form-text" style={{ display: "none" }}>
                  Prenotazione multi-servizio: seleziona un operatore per ogni servizio (se un servizio ha un solo operatore verrà selezionato automaticamente).
                </div>
                <input type="hidden" name="staff_map" id="qb_staff_map" value="" readOnly />
                <input type="hidden" name="cabin_map" id="qb_cabin_map" value="" readOnly />
                <input type="hidden" name="appointment_hold_token" id="qb_appointment_hold_token" value={holdToken} readOnly />
                <div id="qbMultiStaffPicker" className="mt-2" style={{ display: "none" }} />
                <select
                  className="form-select"
                  name="staff_id"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  disabled={startGateDisabled}
                >
                  <option value="">{startGateDisabled ? "Seleziona prima un servizio" : "Operatore automatico"}</option>
                  {staff.map((st) => (
                    <option value={st.id} key={st.id}>{st.name}</option>
                  ))}
                </select>
                <div id="qb_staff_hint" className="form-text" style={{ display: "none" }} />
              </div>
            </div>

            {locations.length > 1 ? (
              <div className="row g-2 mt-1">
                <div className="col-12">
                  <label className="form-label">Sede</label>
                  <select
                    className="form-select"
                    name="location_id"
                    id="qb_location_id"
                    required
                    value={locationId}
                    onChange={(e) => changeLocation(e.target.value)}
                  >
                    <option value="">Seleziona sede</option>
                    {locations.map((loc) => (
                      <option value={loc.id} key={loc.id}>{loc.name || `Sede #${loc.id}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <input type="hidden" name="location_id" value={locationId} readOnly />
            )}

            <div className="row g-2 mt-1">
              <div className="col-12 d-flex gap-2 align-items-end">
                <div className="flex-grow-1">
                  <label className="form-label">Data di inizio</label>
                  <input
                    className="form-control"
                    type="date"
                    id="qb_date"
                    autoComplete="off"
                    required
                    disabled={startGateDisabled}
                    value={date}
                    onChange={(e) => changeDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">&nbsp;</label>
                  <button
                    className="btn btn-outline-primary w-100"
                    type="button"
                    id="qbAvailabilityBtn"
                    disabled={startGateDisabled || availLoading}
                    onClick={runAvailability}
                  >
                    {availLoading ? "..." : <>Disponibilità <i className="bi bi-arrow-right ms-1" /></>}
                  </button>
                </div>
              </div>

              <div className="col-6">
                <label className="form-label">Ora di Inizio</label>
                <input
                  className="form-control"
                  type="time"
                  id="qb_start_time"
                  step={300}
                  autoComplete="off"
                  required
                  value={startTime}
                  onChange={(e) => changeStartTime(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Ora di Fine</label>
                <input className="form-control" type="time" id="qb_end_time" step={300} autoComplete="off" readOnly value={endTime} />
              </div>

              <div className="col-12">
                <div id="qbHoldCountdown" className="alert alert-info d-none py-2 px-3 mb-0 small" role="status" aria-live="polite" />
              </div>

              {/* Hidden datetime-local fields used by backend/API (keep names) */}
              <input type="hidden" name="starts_at" id="qb_starts" value={startTime ? `${date}T${startTime}` : ""} readOnly />
              <input type="hidden" name="ends_at" id="qb_ends" value={endTime ? `${date}T${endTime}` : ""} readOnly />

              {/* Segment view (multi-servizio) */}
              <input type="hidden" name="segment_id" id="qb_segment_id" value="" readOnly />
              <input type="hidden" name="segment_old_starts_at" id="qb_segment_old_starts" value="" readOnly />
              <input type="hidden" name="segment_old_ends_at" id="qb_segment_old_ends" value="" readOnly />
            </div>

            <div className="row g-2 mt-1">
              <div className="col-12">
                <label className="form-label">Cabina</label>
                <select
                  className="form-select"
                  name="cabin_id"
                  id="qb_cabin_id"
                  value={cabinId}
                  onChange={(e) => setCabinId(e.target.value)}
                  disabled={cabins.length === 0}
                >
                  <option value="">{cabins.length ? "Nessuna cabina" : "Seleziona prima la disponibilità…"}</option>
                  {cabins
                    .filter((c) => !c.locationId || !Number(locationId) || c.locationId === Number(locationId))
                    .map((c) => (
                      <option value={c.id} key={c.id}>{c.name}</option>
                    ))}
                </select>
                <div className="form-text" id="qb_cabin_hint">Se sono libere più cabine potrai scegliere; se è libera solo una verrà selezionata automaticamente.</div>
              </div>
            </div>

            <div className="row g-2 mt-1">
              <div className="col-6">
                <label className="form-label">Stato</label>
                <select className="form-select" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">In attesa</option>
                  <option value="scheduled">Prenotato</option>
                  <option value="done">Eseguito</option>
                  <option value="canceled">Annullato</option>
                  <option value="no_show">No show</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Note per lo staff</label>
                <input
                  className="form-control"
                  name="staff_notes"
                  placeholder="(opz.)"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Note del cliente</label>
              <textarea
                className="form-control"
                name="customer_notes"
                rows={3}
                placeholder="(opz.)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>

            {/* Dettaglio prezzi (backend) — TODO: price/coupon/fidelity/discount wiring */}
            <div className="mt-3" id="qbPriceDetailsBox" style={{ display: "none" }}>
              <div className="fw-bold mb-2">Dettaglio prezzi</div>
              <div className="card p-2" style={{ borderRadius: 12 }}>
                <div id="qbPriceDetailsList" className="small" />

                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <div className="text-muted small">Subtotale</div>
                  <div className="text-muted small" id="qbPriceSubtotal">€ 0,00</div>
                </div>

                <input type="hidden" name="coupon_code" id="qb_coupon_code" value="" readOnly />
                <input type="hidden" name="coupon_discount" id="qb_coupon_discount" value="0" readOnly />
                <div className="mt-2">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small mb-0">Coupon</label>
                    <a href="#" className="small text-success text-decoration-underline" id="qbCouponToggle">Hai un codice coupon?</a>
                  </div>
                  <div className="card border-0 bg-light p-2 d-none" id="qbCouponBox">
                    <div className="input-group input-group-sm">
                      <input className="form-control" type="text" id="qbCouponInput" placeholder="Inserisci codice coupon" />
                      <button type="button" className="btn btn-outline-success" id="qbCouponApplyBtn">Applica</button>
                      <button type="button" className="btn btn-outline-secondary" id="qbCouponRemoveBtn">Rimuovi</button>
                    </div>
                    <div className="form-text" id="qbCouponMsg" />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top d-none" id="qbCouponRow" style={{ color: "#047857" }}>
                  <div className="small fw-semibold" id="qbCouponLabel">Coupon</div>
                  <div className="small fw-semibold" id="qbCouponAmount">- € 0,00</div>
                </div>

                <div className="mt-2">
                  <label className="form-label small mb-1">Sconto</label>
                  <div className="d-flex gap-2 align-items-center flex-wrap">
                    <select className="form-select form-select-sm" name="discount_type" id="qb_discount_type" style={{ maxWidth: 120 }}>
                      <option value="">Nessuno</option>
                      <option value="percent">%</option>
                      <option value="fixed">€</option>
                    </select>
                    <input className="form-control form-control-sm" type="number" step="0.01" min="0" inputMode="decimal" name="discount_value" id="qb_discount_value" placeholder="0" style={{ maxWidth: 140 }} />
                    <div className="small text-muted ms-auto" id="qbPriceDiscountAmount">- € 0,00</div>
                  </div>
                </div>

                <input type="hidden" name="fidelity_points_use" id="qb_fidelity_points_use" value="0" readOnly />
                <div className="alert alert-info p-2 mt-2 d-none" id="qbFidelityNote" style={{ borderRadius: 10 }} />

                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top d-none" id="qbGiftcardRow" style={{ color: "#047857" }}>
                  <button type="button" className="btn btn-link btn-sm p-0 fw-semibold qb-giftcard-open" id="qbGiftcardLabel" style={{ color: "inherit", textDecoration: "none" }} title="Dettagli GiftCard">GiftCard</button>
                  <div className="d-flex align-items-center gap-2">
                    <div className="small fw-semibold" id="qbGiftcardAmount">- € 0,00</div>
                    <button type="button" className="btn btn-sm btn-link text-danger p-0 d-none" id="qbGiftcardRemoveBtn" title="Rimuovi GiftCard"><i className="bi bi-x-circle" /></button>
                  </div>
                </div>
                <input type="hidden" name="credit_use" id="qb_credit_use" value="0" readOnly />
                <input type="hidden" name="credit_use_from_booking" id="qb_credit_use_from_booking" value="0" readOnly />
                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top d-none" id="qbCreditRow" style={{ color: "#047857" }}>
                  <div className="small fw-semibold">Credito</div>
                  <div className="small fw-semibold" id="qbCreditAmount">- € 0,00</div>
                </div>

                <div className="card border-0 bg-light p-2 mt-2 d-none" id="qbFidelityBox">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold"><i className="bi bi-percent me-1" /> Punti Fidelity</div>
                    <div className="small text-muted" id="qbFidelityAvail">Disponibili: 0 Punti</div>
                  </div>

                  <div className="mt-2">
                    <div className="d-flex align-items-center d-none" id="qbFidelityToggleRow">
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" id="qbFidelityToggle" />
                        <label className="form-check-label" htmlFor="qbFidelityToggle">Usa sconto Punti Fidelity</label>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-secondary ms-auto d-none" id="qbFidelityMaxBtn">Max</button>
                    </div>

                    <div className="mt-2 d-none" id="qbFidelityAmountWrap">
                      <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                        <input className="form-control" type="number" step="1" min="0" inputMode="numeric" id="qbFidelityAmountInput" placeholder="0" />
                        <span className="input-group-text" id="qbFidelityAmountSuffix">Punti</span>
                      </div>
                    </div>

                    <div className="small text-muted mt-2" id="qbFidelityHint" />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top d-none" id="qbFidelityRow" style={{ color: "#047857" }}>
                  <div className="small fw-semibold" id="qbFidelityLabel">Sconto Fidelity</div>
                  <div className="small fw-semibold" id="qbFidelityAmount">- € 0,00</div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <div className="fw-semibold">Totale</div>
                  <div className="fw-semibold" id="qbPriceTotal">€ 0,00</div>
                </div>
              </div>
            </div>

            {formError ? <div className="alert alert-danger small mt-3 mb-0">{formError}</div> : null}

            <button className="btn btn-primary btn-pill w-100 mt-3" type="submit" id="qbSubmitBtn" disabled={submitting}>
              <span id="qbSubmitText">{submitting ? "Salvataggio..." : "Crea prenotazione"}</span>
            </button>

            <button className="btn btn-outline-danger btn-pill w-100 mt-2" type="button" id="qbDeleteBtn" style={{ display: "none" }}>
              Elimina appuntamento
            </button>
          </form>
        </div>
      </div>

      {/* ===================== FIND CLIENT MODAL (port of qbLinkFindClient flow) ===================== */}
      <div className="modal fade" id="qbClientFindModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="small-muted">Cliente</div>
                <h5 className="modal-title fw-bold m-0">Trova</h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className="input-group mb-3">
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input
                  type="text"
                  className="form-control"
                  id="qbClientFindQuery"
                  placeholder="Inizia a digitare per cercare..."
                  value={findQuery}
                  onChange={(e) => onFindQueryChange(e.target.value)}
                />
                <button className="btn btn-outline-secondary" type="button" id="qbClientFindClear" onClick={() => onFindQueryChange("")}>
                  Annulla
                </button>
              </div>
              <div id="qbClientFindHint" className="text-muted small mb-2">Cerca per nome, cognome, email o telefono.</div>
              <div className="list-group" id="qbClientFindResults">
                {findResults.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="list-group-item list-group-item-action"
                    data-id={c.id}
                    data-name={c.full_name}
                    data-email={c.email}
                    data-phone={c.phone}
                    onClick={() => selectClient(c)}
                  >
                    <div className="fw-semibold">{c.full_name}</div>
                    <div className="small text-muted">{[c.email, c.phone].filter(Boolean).join(" • ") || "—"}</div>
                  </button>
                ))}
                {findQuery.trim() && findResults.length === 0 ? (
                  <div className="text-muted small py-2 px-1">Nessun cliente trovato.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== NEW CLIENT MODAL (verbatim from View.php) ===================== */}
      <div className="modal fade" id="qbClientCreateModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <form className="modal-content" id="qbClientCreateForm" ref={createFormRef} onSubmit={submitNewClient}>
            <div className="modal-header align-items-start">
              <div>
                <div className="small-muted">Cliente</div>
                <h5 className="modal-title fw-bold m-0">Nuovo cliente</h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className={`alert alert-danger small ${createError ? "" : "d-none"}`} id="qbClientCreateAlert" role="alert">
                {createError}
              </div>

              <div className="qb-create-section-title">Informazioni principali</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nome <span className="text-danger">*</span></label>
                  <input className="form-control" name="first_name" required autoComplete="given-name" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cognome <span className="text-danger">*</span></label>
                  <input className="form-control" name="last_name" required autoComplete="family-name" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cellulare</label>
                  <input className="form-control" name="phone" autoComplete="tel" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" name="email" autoComplete="email" />
                </div>
                <div className="col-md-6">
                  <label className="form-label d-block">Sesso</label>
                  <div className="d-flex gap-4 pt-1">
                    <div className="form-check">
                      <input className="form-check-input" type="radio" name="gender" id="qbClientGenderM" value="M" />
                      <label className="form-check-label" htmlFor="qbClientGenderM">Maschio</label>
                    </div>
                    <div className="form-check">
                      <input className="form-check-input" type="radio" name="gender" id="qbClientGenderF" value="F" />
                      <label className="form-check-label" htmlFor="qbClientGenderF">Femmina</label>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Data di nascita</label>
                  <input className="form-control" type="date" name="birth_date" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Luogo di nascita</label>
                  <input className="form-control" name="birth_place" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Data iscrizione</label>
                  <input className="form-control" type="date" name="registration_date" defaultValue={todayIso()} />
                </div>
                {locations.length > 1 ? (
                  <div className="col-md-6">
                    <label className="form-label">Sede di riferimento <span className="text-danger">*</span></label>
                    <select className="form-select" name="location_id" required defaultValue={locationId}>
                      <option value="">Seleziona sede</option>
                      {locations.map((loc) => (
                        <option value={loc.id} key={loc.id}>{loc.name || `Sede #${loc.id}`}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="location_id" value={locationId} readOnly />
                )}
                <div className="col-12">
                  <label className="form-label">Note</label>
                  <textarea className="form-control" name="notes" rows={2} />
                </div>
              </div>

              <div className="qb-create-section-title mt-4">Indirizzo / Contatti</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Regione</label>
                  <input className="form-control" name="region" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Provincia</label>
                  <input className="form-control" name="province" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Citta</label>
                  <input className="form-control" name="city" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">CAP</label>
                  <input className="form-control" name="cap" />
                </div>
                <div className="col-12">
                  <label className="form-label">Indirizzo</label>
                  <input className="form-control" name="address" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Titolo / Lavoro</label>
                  <input className="form-control" name="job_title" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Telefono fisso</label>
                  <input className="form-control" name="phone_home" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cellulare 2</label>
                  <input className="form-control" name="phone2" />
                </div>
              </div>

              <div className="qb-create-section-title mt-4">Info fiscali</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Codice Fiscale</label>
                  <input className="form-control" name="tax_code" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Partita IVA</label>
                  <input className="form-control" name="vat_number" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">SDI</label>
                  <input className="form-control" name="sdi" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Azienda</label>
                  <input className="form-control" name="company_name" />
                </div>
                <div className="col-12">
                  <label className="form-label">PEC</label>
                  <input className="form-control" type="email" name="pec" placeholder="pec@dominio.it" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
              <button type="submit" className="btn btn-primary" id="qbClientCreateSubmit" disabled={createSaving}>
                <span className={`spinner-border spinner-border-sm me-1 ${createSaving ? "" : "d-none"}`} id="qbClientCreateSpinner" aria-hidden="true" />
                <span id="qbClientCreateSubmitText">Salva cliente</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
