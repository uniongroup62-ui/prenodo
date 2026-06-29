"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Faithful port of the PHP calendar page (app/pages/calendar.php / ?page=calendar),
// fed by the existing DB-backed /api/manage/calendar and /api/manage/appointments.
//
// IMPORTANT — what is faithful-but-static vs wired:
//   The legacy page renders the agenda grid (<div id="calendar">) entirely via
//   FullCalendar 6.x driven by /assets/js/pages/calendar.js. That script wires the
//   header toolbar (Giorno/Settimana/Mese tabs, prev/next/today/Data/Ordina), drag &
//   drop, resize, and quick-book-from-cell against api_appointments. Here we reproduce
//   the SAME markup/classes (the FullCalendar header toolbar uses .fc-* classes so the
//   page CSS at /assets/css/pages/calendar.css applies) and render a real
//   staff-columns x time-rows agenda from the API, positioning appointment blocks by
//   time. Interaction parity (added on top of the unchanged rendering):
//     - MOVE: appointment blocks are HTML5-draggable within the Giorno grid; dropping
//       on a staff column computes the target time (snapped to SNAP_MIN, like
//       calendar.js snapDuration 00:05:00) and target operator, optimistically updates,
//       POSTs action=move, and reconciles with the server (reverts on error).
//     - QUICK-BOOK: clicking an empty cell prefills + opens the existing static
//       #apptModal (date/time/operator) and wires its Save button to a minimal
//       action=save create, then refreshes. No new chrome is added — only behavior.
//     - RESIZE (duration change) is left INERT (see route TODO): updateDbAppointment
//       recomputes the end from the service duration, so a custom duration cannot be
//       persisted without a dedicated path.
//   Modals are reproduced verbatim as static Bootstrap markup; only the #apptModal
//   Save/quick-book behavior above is attached, the others remain controller-less.

type CalendarStaff = {
  id: number;
  name: string;
  email: string;
  color: string;
  photoPath: string;
};

type CalendarService = {
  id: number;
  name: string;
  duration?: string;
  price?: string;
  locationIds?: number[];
};

type CalendarLocation = { id: number; name: string };

type CalendarNote = {
  id: number;
  noteDate: string;
  title: string;
  noteText: string;
  createdByName: string;
  updatedByName: string;
  updatedAtLabel: string;
};

type CalendarBusinessHour = {
  dow: number;
  locationId: number | null;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type CalendarContextResponse = {
  ok?: boolean;
  date?: string;
  staff?: CalendarStaff[];
  locations?: CalendarLocation[];
  services?: CalendarService[];
  notes?: CalendarNote[];
  countByDate?: Record<string, number>;
  businessHours?: CalendarBusinessHour[];
};

type Appointment = {
  id: number;
  date: string;
  locationId?: number;
  time: string;
  client: string;
  service: string;
  operator: string;
  room?: string;
  price?: string;
  status: string;
};

type CalendarView = "staffTimeGridDay" | "timeGridWeek" | "dayGridMonth";

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

const IT_WEEKDAYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
const IT_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function capFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function longTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${capFirst(IT_WEEKDAYS[d.getDay()] ?? "")} ${d.getDate()} ${IT_MONTHS[d.getMonth()] ?? ""} ${d.getFullYear()}`;
}

function timeToMin(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Split a datetime-local value ("YYYY-MM-DDTHH:MM") into date / HH:MM parts.
function parseLocalDate(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.exec(value || "");
  return m ? m[1] : "";
}
function parseLocalTime(value: string): string {
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(value || "");
  return m ? m[1] : "";
}

// Bootstrap modal helpers for the static #apptModal. Bootstrap's bundle is already
// loaded by the manage shell (the page uses data-bs-* modals elsewhere); we just
// drive show/hide programmatically for quick-book. Falls back to a no-op when the
// API is unavailable so quick-book degrades to "nothing happens" rather than crashing.
type BootstrapModalApi = {
  getOrCreateInstance: (el: Element) => { show: () => void; hide: () => void };
};
function bootstrapModal(): BootstrapModalApi | null {
  if (typeof window === "undefined") return null;
  const bs = (window as unknown as { bootstrap?: { Modal?: BootstrapModalApi } }).bootstrap;
  return bs?.Modal ?? null;
}
function showApptModal(): void {
  const el = typeof document !== "undefined" ? document.getElementById("apptModal") : null;
  const api = bootstrapModal();
  if (el && api) api.getOrCreateInstance(el).show();
}
function hideApptModal(): void {
  const el = typeof document !== "undefined" ? document.getElementById("apptModal") : null;
  const api = bootstrapModal();
  if (el && api) api.getOrCreateInstance(el).hide();
}

// Map the Italian status label returned by /api/manage/appointments back to the
// legacy calendar badge key (see calendar.js status map).
function statusKeyFromLabel(label: string): { key: string; label: string } {
  const v = String(label || "").trim().toLowerCase();
  if (v === "in attesa" || v === "pending") return { key: "pending", label: "In attesa" };
  if (v === "prenotato" || v === "scheduled" || v === "confermato" || v === "confirmed")
    return { key: "scheduled", label: "Prenotato" };
  if (v === "eseguito" || v === "done" || v === "completato" || v === "completed")
    return { key: "done", label: "Eseguito" };
  if (v === "annullato" || v === "canceled" || v === "cancelled" || v === "rejected")
    return { key: "canceled", label: "Annullato" };
  if (v === "no show" || v === "no_show" || v === "no-show" || v === "non presentato")
    return { key: "no_show", label: "No show" };
  return { key: "other", label: label || "—" };
}

// Pixel grid constants for the static agenda (5-min granularity like calendar.js).
const SLOT_MIN_PER_ROW = 30;
const ROW_HEIGHT = 48; // px per 30-min row
const PX_PER_MIN = ROW_HEIGHT / SLOT_MIN_PER_ROW;
const DEFAULT_DURATION_MIN = 60;
// Snap step for drag-move / quick-book, matching calendar.js snapDuration 00:05:00
// (AXIS_STEP_MINUTES = 5). A dropped/clicked Y position is rounded to this step.
const SNAP_MIN = 5;

function minToTime(min: number): string {
  const clamped = Math.max(0, min);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function snapMin(min: number, step: number): number {
  return Math.round(min / step) * step;
}

// Drag payload moved between an appointment block and a staff/grid drop target.
type CalendarDrag = {
  id: number;
  // Pointer offset (px) from the top of the dragged block to the grab point, so the
  // drop maps the block's TOP (its start time), not the cursor, to the new slot.
  grabOffsetPx: number;
};

export function CalendarContent() {
  const slug = tenantSlug();

  const [date, setDate] = useState<string>(() => isoLocal(new Date()));
  const [view, setView] = useState<CalendarView>("staffTimeGridDay");
  const [staff, setStaff] = useState<CalendarStaff[]>([]);
  const [services, setServices] = useState<CalendarService[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [businessHours, setBusinessHours] = useState<CalendarBusinessHour[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (drive React state; faithful to #filterStaff/#filterService/#filterStatus).
  const [filterStaff, setFilterStaff] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drag-move state. dragRef holds the in-flight payload (the dragged appointment id
  // and the grab offset within the block); a non-null moveError surfaces a revert.
  const dragRef = useRef<CalendarDrag | null>(null);
  const [moveError, setMoveError] = useState("");

  const loadContext = useCallback(
    (forDate: string) => {
      setLoading(true);
      const params = new URLSearchParams({ slug, date: forDate });
      fetch(`/api/manage/calendar?${params.toString()}`, { headers: { "x-tenant-slug": slug } })
        .then((r) => r.json())
        .then((j: CalendarContextResponse) => {
          setStaff(Array.isArray(j.staff) ? j.staff : []);
          setServices(Array.isArray(j.services) ? j.services : []);
          setNotes(Array.isArray(j.notes) ? j.notes : []);
          setBusinessHours(Array.isArray(j.businessHours) ? j.businessHours : []);
        })
        .catch(() => {
          setStaff([]);
          setServices([]);
          setNotes([]);
          setBusinessHours([]);
        });

      const apptParams = new URLSearchParams({ slug, action: "list", date: forDate });
      fetch(`/api/manage/appointments?${apptParams.toString()}`, { headers: { "x-tenant-slug": slug } })
        .then((r) => r.json())
        .then((j: { appointments?: Appointment[] }) => {
          setAppointments(Array.isArray(j.appointments) ? j.appointments : []);
        })
        .catch(() => setAppointments([]))
        .finally(() => setLoading(false));
    },
    [slug],
  );

  useEffect(() => {
    loadContext(date);
  }, [loadContext, date]);

  function href(page: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=${page}`;
  }

  // Visible time window from business hours for the day-of-week (fallback 09:00–19:00).
  const { minMin, maxMin } = useMemo(() => {
    const dow = new Date(`${date}T12:00:00`).getDay();
    const todays = businessHours.filter((b) => b.dow === dow && !b.isClosed && b.openTime && b.closeTime);
    let open = 9 * 60;
    let close = 19 * 60;
    if (todays.length) {
      const opens = todays.map((b) => timeToMin(b.openTime) ?? open);
      const closes = todays.map((b) => timeToMin(b.closeTime) ?? close);
      open = Math.min(...opens);
      close = Math.max(...closes);
    }
    return { minMin: open, maxMin: close };
  }, [businessHours, date]);

  const rows = useMemo(() => {
    const out: number[] = [];
    for (let m = minMin; m <= maxMin; m += SLOT_MIN_PER_ROW) out.push(m);
    return out;
  }, [minMin, maxMin]);

  // Staff columns (apply the operator filter; faithful to STAFF_DAY_COLS).
  const staffCols = useMemo(() => {
    if (!filterStaff) return staff;
    return staff.filter((s) => String(s.id) === filterStaff);
  }, [staff, filterStaff]);

  // Appointments visible for the current real day, after filters.
  const visibleAppts = useMemo(() => {
    return appointments.filter((a) => {
      if (a.date && a.date !== date) return false;
      if (filterStatus) {
        const k = statusKeyFromLabel(a.status).key;
        if (k !== filterStatus) return false;
      }
      if (filterService) {
        const svc = services.find((s) => String(s.id) === filterService);
        if (svc && a.service && a.service.trim().toLowerCase() !== svc.name.trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [appointments, date, filterStatus, filterService, services]);

  function apptsForStaff(staffName: string): Appointment[] {
    const target = staffName.trim().toLowerCase();
    return visibleAppts.filter((a) => (a.operator || "").trim().toLowerCase() === target);
  }

  const totalAppts = visibleAppts.length;
  const totalLabel = totalAppts === 1 ? "appuntamento totale" : "appuntamenti totali";
  const notesCount = notes.length;
  const gridHeight = (rows.length - 1) * ROW_HEIGHT + ROW_HEIGHT;

  function go(deltaDays: number) {
    setDate((d) => addDays(d, deltaDays));
  }

  // Map a Y offset (px, relative to the top of a column's slot body) to a snapped
  // time string, clamped to the visible business-hours window. The slot body starts
  // at minMin, ROW_HEIGHT px per SLOT_MIN_PER_ROW (PX_PER_MIN px per minute).
  const timeFromY = useCallback(
    (offsetPx: number): string => {
      const rawMin = minMin + offsetPx / PX_PER_MIN;
      const snapped = snapMin(rawMin, SNAP_MIN);
      const clamped = Math.min(Math.max(snapped, minMin), maxMin);
      return minToTime(clamped);
    },
    [minMin, maxMin],
  );

  // POST action=move with optimistic update + reconcile. The list is optimistically
  // patched (new time/operator) so the block jumps immediately; on success the server
  // list replaces local state, on error we revert by reloading the day. Tenant-scoped
  // via the slug query + x-tenant-slug header, like the other calendar fetches.
  const moveAppointment = useCallback(
    async (id: number, newTime: string, newOperator: string) => {
      setMoveError("");
      const prev = appointments;
      const target = prev.find((a) => a.id === id);
      if (!target) return;
      if (target.time === newTime && (target.operator || "").trim().toLowerCase() === newOperator.trim().toLowerCase()) {
        return; // no-op drop on the same slot/column
      }

      // Optimistic patch.
      setAppointments((list) => list.map((a) => (a.id === id ? { ...a, time: newTime, operator: newOperator } : a)));

      try {
        const res = await fetch(`/api/manage/appointments?slug=${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
          body: JSON.stringify({
            action: "move",
            id,
            date,
            time: newTime,
            staff_name: newOperator,
          }),
        });
        const json: { ok?: boolean; error?: string; appointments?: Appointment[] } = await res.json().catch(() => ({}));
        if (!res.ok || json.ok === false || json.error) {
          setAppointments(prev); // revert
          setMoveError(String(json.error || "Impossibile spostare l'appuntamento."));
          return;
        }
        // Reconcile with the authoritative server list when provided.
        if (Array.isArray(json.appointments)) setAppointments(json.appointments);
        else loadContext(date);
      } catch {
        setAppointments(prev); // revert on network error
        setMoveError("Errore di rete durante lo spostamento.");
      }
    },
    [appointments, date, loadContext, slug],
  );

  // QUICK-BOOK: prefill + open the existing static #apptModal for the clicked cell,
  // then wire its (otherwise inert) Save button to a minimal action=save create. Uses
  // the modal markup verbatim — only behavior is attached — and shows it via the
  // already-loaded Bootstrap. The create posts client_name (free text taken from the
  // modal's existing "Nuovo cliente" field, surfaced for quick-book), service_name and
  // staff_name; the route resolves/creates the client and recomputes the end.
  const openQuickBook = useCallback(
    (cellTime: string, staffId: number) => {
      if (typeof document === "undefined") return;
      const modalEl = document.getElementById("apptModal");
      if (!modalEl) return;

      // Prefill the modal fields (verbatim markup; we only set values).
      const startsAt = modalEl.querySelector<HTMLInputElement>("#starts_at");
      const endsAt = modalEl.querySelector<HTMLInputElement>("#ends_at");
      const staffSel = modalEl.querySelector<HTMLSelectElement>("#staff_id");
      const idField = modalEl.querySelector<HTMLInputElement>("#appt_id");
      const newClientBox = modalEl.querySelector<HTMLElement>("#newClientBox");
      const newClientName = modalEl.querySelector<HTMLInputElement>('input[name="new_full_name"]');
      const titleEl = modalEl.querySelector<HTMLElement>("#modalTitle");

      const startLocal = `${date}T${cellTime}`;
      const endMin = Math.min((timeToMin(cellTime) ?? minMin) + DEFAULT_DURATION_MIN, maxMin);
      if (startsAt) startsAt.value = startLocal;
      if (endsAt) endsAt.value = `${date}T${minToTime(endMin)}`;
      if (staffSel) staffSel.value = staffId > 0 ? String(staffId) : "";
      if (idField) idField.value = ""; // create (no id)
      if (titleEl) titleEl.textContent = "Nuovo appuntamento";
      // Surface the inline "Nuovo cliente" field so quick-book can capture a name
      // (the route's create resolves/creates the client from client_name).
      if (newClientBox) newClientBox.hidden = false;
      if (newClientName) {
        newClientName.value = "";
        // Defer focus until the modal is shown.
        setTimeout(() => newClientName.focus(), 150);
      }

      // Wire the Save button once (idempotent): submit a minimal create then refresh.
      const saveBtn = modalEl.querySelector<HTMLButtonElement>("#btnSave");
      if (saveBtn && !saveBtn.dataset.qbWired) {
        saveBtn.dataset.qbWired = "1";
        saveBtn.addEventListener("click", async () => {
          const startVal = String(startsAt?.value ?? "");
          const sd = parseLocalDate(startVal);
          const st = parseLocalTime(startVal);
          const clientName = String(newClientName?.value ?? "").trim();
          // Service: use the selected option's name (text before the " • duration"),
          // empty when "(nessuno)" so the route falls back to the first active service.
          const serviceSel = modalEl.querySelector<HTMLSelectElement>("#service_id");
          const serviceName = serviceSel && serviceSel.value
            ? (serviceSel.selectedOptions[0]?.textContent ?? "").split("•")[0].trim()
            : "";
          // Operator: the selected staff's name, empty when "(non assegnato)".
          const operatorName = staffSel && staffSel.value ? (staffSel.selectedOptions[0]?.textContent ?? "").trim() : "";
          if (!sd || !st) return;
          try {
            const res = await fetch(`/api/manage/appointments?slug=${encodeURIComponent(slug)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
              body: JSON.stringify({
                action: "save",
                client_name: clientName,
                service_name: serviceName,
                staff_name: operatorName,
                date: sd,
                time: st,
              }),
            });
            const json: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
            if (!res.ok || json.ok === false || json.error) {
              setMoveError(String(json.error || "Impossibile creare l'appuntamento."));
              return;
            }
            hideApptModal();
            // Reload the day the appointment was created for (read from the live
            // input via `sd`, never the closure `date`, so a wired-once handler stays
            // correct after the user navigates to another day).
            loadContext(sd);
          } catch {
            setMoveError("Errore di rete durante la creazione.");
          }
        });
      }

      showApptModal();
    },
    [date, minMin, maxMin, slug, loadContext],
  );

  function viewBtn(target: CalendarView, label: string) {
    const active = view === target;
    return (
      <button
        type="button"
        className={`fc-button fc-button-primary fc-${target}-button${active ? " fc-button-active" : ""}`}
        aria-pressed={active}
        onClick={() => setView(target)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/calendar.css" />

      <div className="bs-page-header calendar-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Agenda</div>
          <h1 className="bs-page-title">Calendario</h1>
          <div className="bs-page-subtitle">Consulta disponibilita, appuntamenti e note della sede.</div>
        </div>
        <div className="bs-page-actions">
          <button type="button" className="btn btn-outline-secondary btn-sm calendar-notes-top-btn" id="calendarNotesBtn">
            <i className="bi bi-stickies me-1" />
            Note
            <span
              className={`badge rounded-pill text-bg-danger calendar-notes-top-btn__badge${notesCount ? "" : " d-none"}`}
              id="calendarNotesBtnBadge"
            >
              {notesCount}
            </span>
          </button>
          <a className="btn btn-outline-secondary btn-sm" href={href("appointments")}>
            <i className="bi bi-list-task me-1" />
            Lista
          </a>
        </div>
      </div>

      <div className="calendar-page">
        <div className="calendar-filter-bar">
          <input type="hidden" id="filterLocation" value="" />
          <div className="calendar-filter-field calendar-filter-field--staff">
            <label className="form-label small text-muted">Operatore</label>
            <select className="form-select" id="filterStaff" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
              <option value="">Tutti gli operatori</option>
              {staff.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="calendar-filter-field calendar-filter-field--service">
            <label className="form-label small text-muted">Servizio</label>
            <select
              className="form-select"
              id="filterService"
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
            >
              <option value="">Tutti i servizi</option>
              {services.map((s) => (
                <option key={s.id} value={String(s.id)} data-location-ids={(s.locationIds ?? []).join(",")}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="calendar-filter-field calendar-filter-field--status">
            <label className="form-label small text-muted">Stato</label>
            <select className="form-select" id="filterStatus" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tutti</option>
              <option value="pending">In attesa</option>
              <option value="scheduled">Prenotato</option>
              <option value="done">Eseguito</option>
              <option value="canceled">Annullato</option>
              <option value="no_show">No show</option>
            </select>
          </div>
        </div>

        {/* Move/quick-book error surface — only rendered on failure (additive; the
            static layout is unchanged when there is no error). */}
        {moveError ? (
          <div className="alert alert-danger alert-dismissible d-flex align-items-center gap-2 py-2 px-3" role="alert">
            <i className="bi bi-exclamation-triangle" />
            <span className="small">{moveError}</span>
            <button type="button" className="btn-close ms-auto" aria-label="Chiudi" onClick={() => setMoveError("")} />
          </div>
        ) : null}

        <div className="calendar-shell calendar-shell--agenda">
          {/*
            Reproduces the FullCalendar header toolbar + timegrid. Uses .fc-* class names
            so /assets/css/pages/calendar.css styles the toolbar and grid the same way it
            does for the live FullCalendar instance. The grid body is a custom static
            agenda (staff columns x time rows); drag/drop & resize from calendar.js are
            not wired (see file header).
          */}
          <div id="calendar">
            <div className="fc fc-media-screen fc-direction-ltr fc-theme-standard">
              <div className="fc-header-toolbar fc-toolbar fc-toolbar-ltr">
                <div className="fc-toolbar-chunk">
                  <button type="button" className="fc-dayApptTotal-button fc-button fc-button-primary calendar-day-total-indicator">
                    <span className="calendar-day-total-icon" aria-hidden="true">
                      <i className="bi bi-calendar-check" />
                    </span>
                    <span className="calendar-day-total-number">{totalAppts}</span>
                    <span className="calendar-day-total-label">{totalLabel}</span>
                  </button>
                </div>
                <div className="fc-toolbar-chunk">
                  <div className="fc-button-group">
                    <button type="button" className="fc-prev-button fc-button fc-button-primary" aria-label="prev" onClick={() => go(view === "timeGridWeek" ? -7 : view === "dayGridMonth" ? -30 : -1)}>
                      <span className="fc-icon fc-icon-chevron-left" />
                    </button>
                    <button type="button" className="fc-next-button fc-button fc-button-primary" aria-label="next" onClick={() => go(view === "timeGridWeek" ? 7 : view === "dayGridMonth" ? 30 : 1)}>
                      <span className="fc-icon fc-icon-chevron-right" />
                    </button>
                  </div>
                  <h2 className="fc-toolbar-title">{longTitle(date)}</h2>
                  <button type="button" className="fc-today-button fc-button fc-button-primary" onClick={() => setDate(isoLocal(new Date()))}>
                    Oggi
                  </button>
                  <button type="button" className="fc-jumpDate-button fc-button fc-button-primary" onClick={() => {}}>
                    Data
                  </button>
                </div>
                <div className="fc-toolbar-chunk">
                  <div className="fc-button-group">
                    {viewBtn("staffTimeGridDay", "Giorno")}
                    {viewBtn("timeGridWeek", "Settimana")}
                    {viewBtn("dayGridMonth", "Mese")}
                  </div>
                  <button type="button" className="fc-orderStaffCols-button fc-button fc-button-primary" onClick={() => {}}>
                    Ordina
                  </button>
                </div>
              </div>

              <div className="fc-view-harness" style={{ height: gridHeight + 44 }}>
                <div className="fc-view fc-timegrid">
                  {view === "dayGridMonth" || view === "timeGridWeek" ? (
                    <div className="text-muted small p-4">
                      {/* Faithful-but-static: only the Giorno (per-operatore) agenda is rendered as a real grid. */}
                      {view === "dayGridMonth" ? "Vista Mese" : "Vista Settimana"} — usa la vista Giorno per l&apos;agenda per operatore.
                    </div>
                  ) : (
                    <div className="cal-static-grid" style={{ display: "flex", minHeight: gridHeight }}>
                      {/* Time axis */}
                      <div className="cal-static-axis" style={{ flex: "0 0 56px", borderRight: "1px solid var(--calendar-line, #e2e8f0)" }}>
                        <div style={{ height: 44 }} />
                        {rows.map((m) => (
                          <div
                            key={m}
                            className="fc-timegrid-slot-label"
                            style={{
                              height: ROW_HEIGHT,
                              fontSize: 11,
                              color: "#64748b",
                              textAlign: "right",
                              paddingRight: 6,
                              boxSizing: "border-box",
                            }}
                          >
                            {`${pad(Math.floor(m / 60))}:${pad(m % 60)}`}
                          </div>
                        ))}
                      </div>

                      {/* Staff columns */}
                      <div style={{ display: "flex", flex: "1 1 auto", minWidth: 0 }}>
                        {staffCols.length === 0 ? (
                          <div className="text-muted small p-4">{loading ? "Caricamento prenotazioni..." : "Nessun operatore attivo."}</div>
                        ) : (
                          staffCols.map((s) => {
                            const first = (Array.from(s.name.trim())[0] || "O").toUpperCase();
                            const colAppts = apptsForStaff(s.name);
                            const colCount = colAppts.length;
                            return (
                              <div
                                key={s.id}
                                className="fc-timegrid-col"
                                style={{ flex: "1 1 0", minWidth: 0, borderRight: "1px solid var(--calendar-line, #e2e8f0)", position: "relative" }}
                              >
                                <div
                                  className="fc-col-header-cell"
                                  style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--calendar-line, #e2e8f0)" }}
                                >
                                  <div className="staff-col-head" data-staff-id={s.id}>
                                    {s.photoPath ? (
                                      <span className="staff-col-avatar">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={s.photoPath} alt="" />
                                      </span>
                                    ) : (
                                      <span className="staff-col-avatar staff-col-avatar-fallback" data-staff-id={s.id} style={{ background: s.color }}>
                                        {first}
                                      </span>
                                    )}
                                    <span className="staff-col-copy">
                                      <span className="staff-col-name">{s.name}</span>
                                      <span className="staff-col-count" data-staff-id={s.id}>
                                        {colCount === 1 ? "1 appuntamento" : `${colCount} appuntamenti`}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {/* Slot rows (background). Doubles as the staff column's
                                    drop target (MOVE) and quick-book surface (empty-cell
                                    click). The handlers compute the Y offset within this
                                    body, which starts at minMin. */}
                                <div
                                  style={{ position: "relative", height: gridHeight }}
                                  onDragOver={(e) => {
                                    // Required so the browser fires onDrop on this element.
                                    if (dragRef.current) {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "move";
                                    }
                                  }}
                                  onDrop={(e) => {
                                    const drag = dragRef.current;
                                    if (!drag) return;
                                    e.preventDefault();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // Map the block TOP (cursor - grab offset), not the cursor.
                                    const topPx = e.clientY - rect.top - drag.grabOffsetPx;
                                    void moveAppointment(drag.id, timeFromY(topPx), s.name);
                                    dragRef.current = null;
                                  }}
                                  onClick={(e) => {
                                    // Quick-book only on the empty background, never on a block
                                    // (blocks stopPropagation). Ignore right after a drag.
                                    if (dragRef.current) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    openQuickBook(timeFromY(e.clientY - rect.top), s.id);
                                  }}
                                >
                                  {rows.map((m) => (
                                    <div
                                      key={m}
                                      className="fc-timegrid-slot"
                                      style={{ height: ROW_HEIGHT, borderTop: "1px solid var(--calendar-line, #eef2f7)", boxSizing: "border-box" }}
                                    />
                                  ))}

                                  {/* Appointment blocks positioned by time */}
                                  {colAppts.map((a) => {
                                    const startMin = timeToMin(a.time);
                                    if (startMin === null) return null;
                                    const top = (startMin - minMin) * PX_PER_MIN;
                                    const height = Math.max(DEFAULT_DURATION_MIN * PX_PER_MIN - 2, 18);
                                    const st = statusKeyFromLabel(a.status);
                                    return (
                                      <a
                                        key={a.id}
                                        href={href(`appointments&action=view&id=${a.id}`)}
                                        className="fc-event fc-timegrid-event appt-soft-event"
                                        title={`${a.time} ${a.client} • ${a.service}`}
                                        draggable
                                        onDragStart={(e) => {
                                          // Record the grabbed appointment + the pointer offset
                                          // from the block top, so the drop maps the block start.
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          dragRef.current = { id: a.id, grabOffsetPx: e.clientY - rect.top };
                                          e.dataTransfer.effectAllowed = "move";
                                          // Some browsers require data to start a drag.
                                          try { e.dataTransfer.setData("text/plain", String(a.id)); } catch { /* ignore */ }
                                        }}
                                        onDragEnd={() => {
                                          // Clear shortly after so the synthetic click that follows
                                          // a drag does not trigger quick-book on the column.
                                          setTimeout(() => { dragRef.current = null; }, 0);
                                        }}
                                        onClick={(e) => {
                                          // Keep the block from bubbling to the column's quick-book
                                          // click; suppress the navigation when a drag just happened.
                                          e.stopPropagation();
                                          if (dragRef.current) e.preventDefault();
                                        }}
                                        style={{
                                          position: "absolute",
                                          top,
                                          height,
                                          left: 2,
                                          right: 2,
                                          overflow: "hidden",
                                          borderRadius: 6,
                                          padding: "3px 6px",
                                          fontSize: 12,
                                          textDecoration: "none",
                                          borderLeft: `3px solid ${s.color}`,
                                          background: "#f4f8ff",
                                          color: "#14326f",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        <div className="fc-event-main">
                                          <span className={`appt-status-badge status-${st.key}`} title={`Stato: ${st.label}`}>
                                            {st.label}
                                          </span>
                                          <span className="appt-staff-dot" style={{ background: s.color }} />
                                          <div className="fw-semibold" style={{ lineHeight: 1.15 }}>
                                            {a.time} {a.client}
                                          </div>
                                          <div className="small text-truncate">{a.service}</div>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal appuntamento (editor rapido) — static markup; controller not wired. */}
      <div className="modal fade" id="apptModal" tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="small-muted">Appuntamento</div>
                <h5 className="modal-title fw-bold m-0" id="modalTitle">
                  Nuovo appuntamento
                </h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div id="modalAlert" />
              <form id="apptForm">
                <input type="hidden" name="id" id="appt_id" />
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center">
                      <label className="form-label mb-0">Cliente</label>
                      <div className="d-flex gap-3 small">
                        <a href="#" id="linkNewClient" className="text-decoration-none">
                          <i className="bi bi-plus-lg" /> Nuovo
                        </a>
                        <a href="#" id="linkFindClient" className="text-decoration-none">
                          <i className="bi bi-search" /> Trova
                        </a>
                      </div>
                    </div>
                    <select className="form-select" name="client_id" id="client_id" required defaultValue="">
                      <option value="">Seleziona…</option>
                      <option value="__new__">+ Nuovo cliente…</option>
                    </select>
                    <div className="form-text">Seleziona un cliente o creane uno nuovo.</div>
                  </div>

                  <div className="col-md-6" id="newClientBox" hidden>
                    <label className="form-label">Nuovo cliente</label>
                    <div className="row g-2">
                      <div className="col-12">
                        <input className="form-control" name="new_full_name" placeholder="Nome e cognome" />
                      </div>
                      <div className="col-md-6">
                        <input className="form-control" name="new_phone" placeholder="Telefono" />
                      </div>
                      <div className="col-md-6">
                        <input className="form-control" name="new_email" placeholder="Email" />
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Servizio</label>
                    <select className="form-select" name="service_id" id="service_id" defaultValue="">
                      <option value="">(nessuno)</option>
                      {services.map((s) => (
                        <option
                          key={s.id}
                          value={String(s.id)}
                          data-location-ids={(s.locationIds ?? []).join(",")}
                        >
                          {s.name}
                          {s.duration ? ` • ${s.duration}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Operatore</label>
                    <select className="form-select" name="staff_id" id="staff_id" defaultValue="">
                      <option value="">(non assegnato)</option>
                      {staff.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input type="hidden" name="location_id" id="location_id" value="" />

                  <div className="col-md-6">
                    <label className="form-label">Inizio</label>
                    <input className="form-control" type="datetime-local" name="starts_at" id="starts_at" required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Fine</label>
                    <input className="form-control" type="datetime-local" name="ends_at" id="ends_at" required />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Stato</label>
                    <select className="form-select" name="status" id="status" defaultValue="pending">
                      <option value="pending">In attesa</option>
                      <option value="scheduled">Prenotato</option>
                      <option value="done">Eseguito</option>
                      <option value="canceled">Annullato</option>
                      <option value="no_show">No show</option>
                    </select>
                  </div>

                  <div className="col-md-8">
                    <label className="form-label">Note</label>
                    <input className="form-control" name="notes" id="notes" placeholder="(opzionale)" />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <button type="button" className="btn btn-outline-danger btn-pill" id="btnDelete" hidden>
                <i className="bi bi-trash me-1" />
                Elimina
              </button>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary btn-pill" data-bs-dismiss="modal">
                  Chiudi
                </button>
                <button type="button" className="btn btn-primary btn-pill" id="btnSave">
                  <i className="bi bi-check2-circle me-1" />
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Trova cliente */}
      <div className="modal fade" id="clientFindModal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="small-muted">Cliente</div>
                <h5 className="modal-title fw-bold m-0">Trova</h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="input-group mb-3">
                <span className="input-group-text">
                  <i className="bi bi-search" />
                </span>
                <input type="text" className="form-control" id="clientFindQuery" placeholder="Inizia a digitare per cercare..." />
                <button className="btn btn-outline-secondary" type="button" id="clientFindClear">
                  Annulla
                </button>
              </div>
              <div id="clientFindHint" className="text-muted small mb-2">
                Cerca per nome, cognome, email o telefono.
              </div>
              <div className="list-group" id="clientFindResults" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Ordina colonne operatori (vista Giorno) */}
      <div className="modal fade" id="staffOrderModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="small-muted">Calendario</div>
                <h5 className="modal-title fw-bold m-0">Ordina colonne operatori</h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="text-muted small mb-3">
                La <strong>prima colonna</strong> è sempre la tua. Puoi ordinare le colonne degli altri operatori (trascina oppure usa
                le frecce).
              </div>
              <div id="staffOrderPinnedInfo" className="alert alert-light border d-flex align-items-center gap-2 py-2 px-3" hidden>
                <i className="bi bi-person-circle" />
                <div className="small">
                  La tua colonna: <strong id="staffOrderPinnedName" />
                </div>
              </div>
              <div className="list-group" id="staffOrderList" />
              <div id="staffOrderEmpty" className="text-muted small mt-2" hidden>
                Nessun altro operatore da ordinare.
              </div>
              <div id="staffOrderErr" className="text-danger small mt-2" hidden />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annulla
              </button>
              <button type="button" className="btn btn-primary" id="staffOrderSave">
                <i className="bi bi-check2-circle me-1" />
                Salva
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Note calendario */}
      <div className="modal fade" id="calendarNotesModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="small-muted">Calendario</div>
                <h5 className="modal-title fw-bold m-0">Note</h5>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="row g-4">
                <div className="col-lg-5">
                  <div id="calendarNotesAlert" />
                  <form id="calendarNotesForm" className="vstack gap-3">
                    <input type="hidden" id="calendar_note_id" name="id" defaultValue="" />
                    <div>
                      <label className="form-label">Giorno</label>
                      <input type="date" className="form-control" id="calendar_note_date" name="note_date" required defaultValue={date} />
                    </div>
                    <div>
                      <label className="form-label">Titolo</label>
                      <input type="text" className="form-control" id="calendar_note_title" name="title" maxLength={190} placeholder="Titolo opzionale" />
                    </div>
                    <div>
                      <label className="form-label">Nota</label>
                      <textarea className="form-control" id="calendar_note_text" name="note_text" rows={8} placeholder="Scrivi qui la nota del giorno" required />
                    </div>
                    <div className="small text-muted">
                      Puoi inserire piu note nello stesso giorno e scegliere qualsiasi data. A destra vedi le note del periodo visibile
                      oppure, dalla vista settimana, solo quelle del giorno selezionato.
                    </div>
                  </form>
                </div>
                <div className="col-lg-7">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div>
                      <div className="small-muted" id="calendarNotesRangeCaption">
                        Periodo visibile
                      </div>
                      <div className="fw-semibold" id="calendarNotesRangeLabel">
                        {longTitle(date)}
                      </div>
                      <div className="small text-muted" id="calendarNotesRangeHint">
                        {notesCount === 1 ? "1 nota nel periodo visibile" : `${notesCount} note nel periodo visibile`}
                      </div>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-secondary" id="calendarNotesNewBtn">
                      <i className="bi bi-plus-circle me-1" />
                      Nuova
                    </button>
                  </div>
                  <div id="calendarNotesList" className="calendar-notes-list">
                    {notes.length === 0 ? (
                      <div className="calendar-note-empty">
                        <div className="fw-semibold mb-1">Nessuna nota nel periodo visibile</div>
                        <div className="small">Crea una nota dal modulo a sinistra.</div>
                      </div>
                    ) : (
                      notes.map((n) => (
                        <div className="calendar-note-card" key={n.id} data-note-id={n.id}>
                          {n.title ? <div className="calendar-note-card-title">{n.title}</div> : null}
                          <div className="calendar-note-card-text">{n.noteText}</div>
                          <div className="calendar-note-card-meta">
                            {n.noteDate}
                            {n.updatedAtLabel ? ` • ${n.updatedAtLabel}` : ""}
                            {n.updatedByName ? ` • ${n.updatedByName}` : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer flex-wrap gap-2 justify-content-start">
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Chiudi
                </button>
                <button type="submit" form="calendarNotesForm" className="btn btn-primary" id="calendarNotesSaveBtn">
                  <i className="bi bi-check2-circle me-1" />
                  Salva nota
                </button>
              </div>
              <button type="button" className="btn btn-outline-danger d-none ms-auto" id="calendarNoteDeleteBtn">
                <i className="bi bi-trash me-1" />
                Elimina
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
