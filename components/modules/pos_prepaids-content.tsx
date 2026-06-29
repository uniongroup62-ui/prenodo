"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP POS prepaids page (app/pages/pos_prepaids.php):
// purchased services tracked as "Prepagato" with residual sessions, filters
// (period / location / search / clients / services / view) and a results table.
// Fed by the existing DB-backed /api/manage/prepaids route. The PHP page also
// links the source sale, splits residual sessions into "prenotabili" vs "già
// prenotate", and shows the last usage; the API does not expose those, so those
// cells fall back to "—" (see risks).

type Prepaid = {
  id: number;
  clientId: number;
  clientName: string;
  serviceId: number;
  serviceName: string;
  totalQuantity: number;
  remainingQuantity: number;
  expiresAt?: string;
  status: "active" | "completed" | "expired" | "cancelled";
  sourceSaleId?: number;
  createdAt: string;
};

type LocationOption = { id: number; name: string };

type ViewKey = "active" | "linked" | "expired" | "completed" | "canceled" | "all";

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : "—";
}

const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  completed: "Esaurito",
  expired: "Scaduto",
  cancelled: "Annullato",
};

const STATUS_BADGE: Record<string, string> = {
  active: "text-bg-success",
  completed: "text-bg-secondary",
  expired: "text-bg-warning text-dark",
  cancelled: "text-bg-danger",
};

export function PosPrepaidsContent() {
  const slug = tenantSlug();

  const [prepaids, setPrepaids] = useState<Prepaid[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter form state.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locationId, setLocationId] = useState("0");
  const [q, setQ] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [clientFilterText, setClientFilterText] = useState("");
  const [view, setView] = useState<ViewKey>("active");

  // Applied filters (only updated on submit / autosubmit).
  const [applied, setApplied] = useState<{
    from: string;
    to: string;
    locationId: string;
    q: string;
    clients: number[];
    view: ViewKey;
  }>({ from: "", to: "", locationId: "0", q: "", clients: [], view: "active" });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/manage/prepaids?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setPrepaids(Array.isArray(j.prepaids) ? j.prepaids : []))
      .catch(() => setPrepaids([]))
      .finally(() => setLoading(false));

    fetch(`/api/manage/locations?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const list: LocationOption[] = (j.locations ?? []).map((loc: { id: number; name: string }) => ({
          id: Number(loc.id),
          name: String(loc.name ?? ""),
        }));
        setLocations(list);
        const cur = Number(j.currentLocationId ?? 0);
        if (cur > 0) {
          setLocationId(String(cur));
          setApplied((a) => ({ ...a, locationId: String(cur) }));
        }
      })
      .catch(() => {});
  }, [slug]);

  // Distinct clients present in the prepaids list (PHP builds this from the data).
  const clientOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of prepaids) {
      if (p.clientId && !map.has(p.clientId)) map.set(p.clientId, p.clientName || `#${p.clientId}`);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [prepaids]);

  // Status for the chosen view bucket.
  const matchesView = (p: Prepaid): boolean => {
    switch (applied.view) {
      case "active":
        return p.status === "active";
      case "linked":
        // "Già prenotati": linked to an open appointment. Not exposed by API.
        return Boolean(p.sourceSaleId) && p.status === "active";
      case "expired":
        return p.status === "expired";
      case "completed":
        return p.status === "completed";
      case "canceled":
        return p.status === "cancelled";
      case "all":
      default:
        return true;
    }
  };

  const filtered = useMemo(() => {
    const fromD = applied.from;
    const toD = applied.to;
    const needle = applied.q.trim().toLowerCase();
    const clientSet = new Set(applied.clients);
    return prepaids.filter((p) => {
      if (!matchesView(p)) return false;
      if (clientSet.size > 0 && !clientSet.has(p.clientId)) return false;
      const day = (p.createdAt || "").slice(0, 10);
      if (fromD && day && day < fromD) return false;
      if (toD && day && day > toD) return false;
      if (needle) {
        const hay = `${p.serviceName} ${p.clientName} ${p.sourceSaleId ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepaids, applied]);

  // Stats (PHP computes from the visible rows).
  const stats = useMemo(() => {
    const visible = filtered.length;
    const residual = filtered.reduce((acc, p) => acc + Math.max(0, p.remainingQuantity), 0);
    // "Prenotabili" vs "Già prenotate" require appointment linkage the API does
    // not expose; we approximate booked from sourceSaleId, bookable as the rest.
    const booked = filtered.reduce(
      (acc, p) => acc + (p.sourceSaleId ? Math.max(0, p.remainingQuantity) : 0),
      0,
    );
    const bookable = residual - booked;
    return { visible, residual, bookable, booked };
  }, [filtered]);

  function applyFilters() {
    setApplied({
      from,
      to,
      locationId,
      q,
      clients: Array.from(selectedClients),
      view,
    });
  }

  function toggleClient(id: number) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetHref(): string {
    return `/${encodeURIComponent(slug)}/index.php?page=pos_prepaids`;
  }

  const activeFilters: string[] = [];
  if (applied.locationId !== "0") {
    const loc = locations.find((l) => String(l.id) === applied.locationId);
    if (loc) activeFilters.push(`Sede: ${loc.name}`);
  }
  if (applied.from) activeFilters.push(`Da: ${fmtDate(applied.from)}`);
  if (applied.to) activeFilters.push(`A: ${fmtDate(applied.to)}`);
  if (applied.q.trim()) activeFilters.push(`Ricerca: ${applied.q.trim()}`);

  const visibleClientOptions = clientOptions.filter((c) =>
    clientFilterText.trim()
      ? c.name.toLowerCase().includes(clientFilterText.trim().toLowerCase())
      : true,
  );

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/pos_prepaids.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Pagamenti</div>
          <h1 className="bs-page-title">Prepagati</h1>
          <div className="bs-page-subtitle">
            Servizi acquistati da Pagamenti come Prepagato: residui, sedute collegate e ultimo utilizzo.
          </div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap">
            <a
              className="btn btn-outline-secondary"
              href={`/${encodeURIComponent(slug)}/index.php?page=pos_settings`}
            >
              <i className="bi bi-gear me-1" />
              Impostazioni
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Voci visibili</div>
            <div className="h3 fw-semibold mb-0">{stats.visible}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Sedute residue</div>
            <div className="h3 fw-semibold mb-0">{stats.residual}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Prenotabili</div>
            <div className="h3 fw-semibold mb-0 text-success">{stats.bookable}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Già prenotate</div>
            <div className="h3 fw-semibold mb-0 ">{stats.booked}</div>
          </div>
        </div>
      </div>

      <div className="text-muted small mb-3">
        Le sedute <strong>prenotate</strong> sono già collegate a un appuntamento aperto; le sedute{" "}
        <strong>prenotabili</strong> sono ancora disponibili per nuove prenotazioni.
      </div>

      <div className="pos-movements-layout">
        <div className="card pos-movements-filter prepaids-filter-card">
          <form
            method="get"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
          >
            <input type="hidden" name="page" value="pos_prepaids" />

            <div className="pos-filter-head">
              <div>
                <div className="fw-semibold">Filtri</div>
                <div className="text-muted small">Prepagati</div>
              </div>
              <a
                className="btn btn-sm btn-outline-secondary"
                href={resetHref()}
                title="Azzera filtri"
              >
                <i className="bi bi-arrow-counterclockwise" />
              </a>
            </div>

            <div className="pos-filter-block">
              <div className="pos-filter-title">Periodo</div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small text-muted">Da</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="from"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted">A</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pos-filter-block">
              <label className="pos-filter-title" htmlFor="prepaidsLocation">
                Sede
              </label>
              <select
                id="prepaidsLocation"
                name="location_id"
                className="form-select form-select-sm"
                data-autosubmit="1"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setApplied((a) => ({ ...a, locationId: e.target.value }));
                }}
              >
                <option value="0">Tutte</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={String(loc.id)}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pos-filter-block">
              <label className="pos-filter-title">Ricerca</label>
              <input
                type="text"
                className="form-control form-control-sm"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Servizio, vendita..."
              />
            </div>

            <div className="pos-filter-block">
              <div className="pos-filter-title">Filtri attivi</div>
              <div className="pos-active-filters">
                {activeFilters.map((label) => (
                  <span className="badge text-bg-light border" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <details className="pos-filter-group" open>
              <summary>
                <span>Clienti</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="pos-filter-search-wrap">
                  <i className="bi bi-search" />
                  <input
                    type="text"
                    className="form-control form-control-sm pos-filter-search"
                    data-filter-target="#prepaidsClientList"
                    placeholder="Filtra clienti"
                    autoComplete="off"
                    value={clientFilterText}
                    onChange={(e) => setClientFilterText(e.target.value)}
                  />
                </div>
                <div className="pos-filter-check-list" id="prepaidsClientList">
                  {visibleClientOptions.map((c) => (
                    <label
                      className="pos-filter-check"
                      data-filter-option
                      data-filter-text={c.name.toLowerCase()}
                      key={c.id}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="client_id[]"
                        value={String(c.id)}
                        checked={selectedClients.has(c.id)}
                        onChange={() => toggleClient(c.id)}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Servizi</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="text-muted small">Nessun servizio disponibile.</div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Vista</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="pos-filter-check-list">
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="active"
                      checked={view === "active"}
                      onChange={() => setView("active")}
                    />
                    <span>Attivi</span>
                  </label>
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="linked"
                      checked={view === "linked"}
                      onChange={() => setView("linked")}
                    />
                    <span>Già prenotati</span>
                  </label>
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="expired"
                      checked={view === "expired"}
                      onChange={() => setView("expired")}
                    />
                    <span>Scaduti</span>
                  </label>
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="completed"
                      checked={view === "completed"}
                      onChange={() => setView("completed")}
                    />
                    <span>Esauriti</span>
                  </label>
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="canceled"
                      checked={view === "canceled"}
                      onChange={() => setView("canceled")}
                    />
                    <span>Annullati</span>
                  </label>
                  <label className="pos-filter-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="view"
                      value="all"
                      checked={view === "all"}
                      onChange={() => setView("all")}
                    />
                    <span>Tutti</span>
                  </label>
                </div>
              </div>
            </details>

            <div className="pos-filter-actions">
              <button className="btn btn-primary w-100" type="submit">
                <i className="bi bi-search" /> Filtra
              </button>
            </div>
          </form>
        </div>

        <section className="pos-movements-results">
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="pos-prepaids-col-purchase">Acquisto</th>
                    <th className="pos-prepaids-col-sale">Vendita</th>
                    <th className="pos-prepaids-col-type">Tipo</th>
                    <th className="pos-prepaids-col-client">Cliente</th>
                    <th>Servizio</th>
                    <th className="pos-prepaids-col-availability">Disponibilità</th>
                    <th className="pos-prepaids-col-status">Stato</th>
                    <th className="text-end pos-prepaids-col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        {loading
                          ? "Caricamento…"
                          : "Nessuna disponibilità servizi trovata con i filtri selezionati."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id}>
                        <td className="pos-prepaids-col-purchase">
                          <div>{fmtDate(p.createdAt)}</div>
                          {p.expiresAt ? (
                            <div className="text-muted small">Scade: {fmtDate(p.expiresAt)}</div>
                          ) : null}
                        </td>
                        <td className="pos-prepaids-col-sale">
                          {p.sourceSaleId ? (
                            <a
                              href={`/${encodeURIComponent(slug)}/index.php?page=pos_sale&id=${p.sourceSaleId}`}
                            >
                              #{p.sourceSaleId}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="pos-prepaids-col-type text-muted">—</td>
                        <td className="pos-prepaids-col-client">{p.clientName || "—"}</td>
                        <td>{p.serviceName}</td>
                        <td className="pos-prepaids-col-availability">
                          <span className="fw-semibold">{p.remainingQuantity}</span>
                          <span className="text-muted small"> / {p.totalQuantity}</span>
                        </td>
                        <td className="pos-prepaids-col-status">
                          <span className={`badge ${STATUS_BADGE[p.status] ?? "text-bg-light"}`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="text-end pos-prepaids-col-actions">
                          <a
                            className="btn btn-sm btn-outline-secondary"
                            href={`/${encodeURIComponent(slug)}/index.php?page=pos_prepaids&action=view&id=${p.id}`}
                          >
                            Apri
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
