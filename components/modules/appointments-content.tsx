"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Pixel-faithful port of the PHP appointments list page (?page=appointments),
// fed by the existing DB-backed /api/manage/appointments?action=list.
//
// Faithful to the legacy markup: original Bootstrap classes + `bi bi-*` icons,
// the `appointments-page` wrapper, `appointments-filter-bar` filter form, the
// `appointments-list-card` toolbar (bulk-delete) + `appointments-table`, the
// status badges and the per-row Modifica/Elimina actions. Styling comes from
// /assets/css/pages/appointments.css (linked below, present under
// prenodo/public/assets/css/pages/).
//
// WIRED (live): the appointments table + status badges + the Dal/Al/Cerca
// filters (applied client-side over the fetched list). Slug is read from the
// pathname. Action links point at the legacy /{slug}/index.php?page=... routes.
//
// FAITHFUL-BUT-STATIC: the bulk-delete form, the per-row "Modifica" quick-booking
// edit trigger (data-qb-edit) and the new/edit appointment drawer + quick-booking
// flow are reproduced as inert markup (no submit/JS handlers) — the legacy
// appointments.js drawer is not ported. Legacy `_csrf` hidden inputs are dropped.
//
// DATA NOTE: the Next API returns { id, date, locationId, time, client, service,
// operator, room, price, status } and exposes NO booking code and NO end time.
// The PHP page rendered `<code>#NNNNN</code>` and a `start → end` range; here the
// code column is synthesized as `#{id}` and the date cell shows the start time
// only (the API does not return an end time / booking code).

type Appointment = {
  id: number;
  date?: string;
  locationId?: number | null;
  time: string;
  client: string;
  service: string;
  operator: string;
  room: string;
  price: string;
  status: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const last = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { from: first, to: last };
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Map the UI status label returned by the API to the legacy badge variant.
function statusBadge(status: string): { className: string; label: string } {
  const key = status.trim().toLowerCase();
  if (key === "completato" || key === "done" || key === "completed") {
    return { className: "appointments-status-badge--done", label: status };
  }
  if (key === "in attesa" || key === "pending" || key === "waiting") {
    return { className: "appointments-status-badge--pending", label: status };
  }
  if (key === "annullato" || key === "canceled" || key === "cancelled") {
    return { className: "appointments-status-badge--canceled", label: status };
  }
  if (key === "no_show" || key === "no show") {
    return { className: "appointments-status-badge--no-show", label: status };
  }
  // Confermato / scheduled / anything else.
  return { className: "appointments-status-badge--scheduled", label: status };
}

export function AppointmentsContent() {
  const slug = tenantSlug();
  const defaults = useMemo(() => monthRange(), []);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state (kept working client-side over the loaded appointments).
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/appointments?slug=${encodeURIComponent(slug)}&action=list`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setAppointments(Array.isArray(j.appointments) ? j.appointments : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return appointments.filter((appt) => {
      const day = appt.date ?? "";
      if (from && day && day < from) return false;
      if (to && day && day > to) return false;
      if (term) {
        const haystack = `${appt.client} #${appt.id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [appointments, from, to, q]);

  function pageHref(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=appointments${suffix}`;
  }

  const resetHref = pageHref("");

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/appointments.css" />

      <div className="bs-page-header appointments-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Agenda</div>
          <h1 className="bs-page-title">Lista appuntamenti</h1>
          <div className="bs-page-subtitle">Gestisci prenotazioni, stati e passaggio rapido al calendario.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=calendar`}>
            <i className="bi bi-calendar3 me-1"></i>Calendario
          </a>
        </div>
      </div>

      <div className="appointments-page">
        <div className="appointments-filter-bar">
          <form
            className="appointments-filter-form"
            method="get"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input type="hidden" name="page" value="appointments" />
            <div className="appointments-filter-field">
              <label className="form-label">Dal</label>
              <input
                className="form-control"
                type="date"
                name="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="appointments-filter-field">
              <label className="form-label">Al</label>
              <input
                className="form-control"
                type="date"
                name="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="appointments-filter-field appointments-filter-field--search">
              <label className="form-label">Cerca</label>
              <input
                className="form-control"
                type="text"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cliente o codice prenotazione"
              />
            </div>
            <div className="appointments-filter-actions">
              <button className="btn btn-outline-primary appointments-filter-submit app-filter-submit" type="submit">
                <i className="bi bi-search me-1"></i>Filtra
              </button>
              <a
                className="btn btn-outline-secondary appointments-filter-reset app-filter-reset"
                href={resetHref}
                onClick={(e) => {
                  e.preventDefault();
                  setFrom(defaults.from);
                  setTo(defaults.to);
                  setQ("");
                }}
              >
                Reset
              </a>
            </div>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-list-toolbar">
            <div className="appointments-selection-info" id="bulkSelInfo">
              0 selezionati
            </div>
            {/* Faithful-but-static: legacy bulk-delete form (no submit handler, _csrf dropped). */}
            <form
              method="post"
              action={pageHref("&action=bulk_delete")}
              className="appointments-bulk-actions"
              onSubmit={(e) => e.preventDefault()}
            >
              <input type="hidden" name="ids" id="bulkDeleteIds" value="" />
              <button
                className="btn btn-outline-danger appointments-bulk-delete"
                type="submit"
                id="bulkDeleteBtn"
                disabled
              >
                <i className="bi bi-trash me-1"></i>Elimina selezionati
              </button>
            </form>
          </div>
          <div className="table-responsive appointments-table-wrap">
            <table className="table appointments-table mb-0" id="appointmentsTable">
              <thead>
                <tr>
                  <th className="appointments-select-col">
                    <input className="form-check-input" type="checkbox" id="apptSelectAll" aria-label="Seleziona tutti" />
                  </th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Codice prenotazione</th>
                  <th>Servizio</th>
                  <th>Operatore</th>
                  <th>Stato</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-muted small p-3">
                      {loading ? "Caricamento…" : "Nessun appuntamento."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((appt) => {
                    const badge = statusBadge(appt.status);
                    return (
                      <tr key={appt.id}>
                        <td>
                          <input
                            className="form-check-input appt-select"
                            type="checkbox"
                            value={appt.id}
                            aria-label="Seleziona appuntamento"
                            title=""
                          />
                        </td>
                        <td>
                          {fmtDate(appt.date)} {appt.time}
                        </td>
                        <td className="fw-semibold">{appt.client}</td>
                        <td className="text-muted">
                          <code>#{appt.id}</code>
                        </td>
                        <td className="text-muted">{appt.service}</td>
                        <td className="text-muted">{appt.operator}</td>
                        <td>
                          <span className={`appointments-status-badge ${badge.className}`}>{badge.label}</span>
                        </td>
                        <td className="text-end">
                          {/* Faithful-but-static: quick-booking edit drawer (data-qb-edit) is not ported. */}
                          <a className="btn btn-sm btn-outline-secondary" href="#" data-qb-edit={appt.id}>
                            Modifica
                          </a>{" "}
                          <a
                            className="btn btn-sm btn-outline-danger"
                            href={pageHref(`&action=delete&id=${appt.id}`)}
                            data-confirm="Eliminare questo appuntamento?"
                          >
                            Elimina
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
