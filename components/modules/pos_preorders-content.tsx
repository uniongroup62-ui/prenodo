"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP POS preorders page (app/pages/pos_preorders.php):
// KPI tiles, a left filter rail (period / location / search / clients / products /
// view) and a results table of products with status "Ordinato" waiting for
// pickup. Fed by the existing DB-backed /api/manage/preorders, plus the
// locations and clients lists for the filter rail.

type Preorder = {
  id: number;
  clientId: number;
  clientName: string;
  productId: number;
  productName: string;
  quantity: number;
  deposit: number;
  dueDate: string;
  status: "open" | "collected";
  createdAt?: string;
  collectedAt?: string;
};

type LocationItem = { id: number; name?: string };
type ClientItem = { id: number; name?: string };

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

export function PosPreordersContent() {
  const slug = tenantSlug();

  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state (the PHP page submits a GET form; here filters apply client-side).
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locationId, setLocationId] = useState("0");
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [selectedClients, setSelectedClients] = useState<Record<number, boolean>>({});
  const [view, setView] = useState("active");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/preorders?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setPreorders(Array.isArray(j.preorders) ? j.preorders : []))
      .catch(() => setPreorders([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
    fetch(`/api/manage/locations?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => setLocations(Array.isArray(j.locations) ? j.locations : []))
      .catch(() => {});
    fetch(`/api/manage/clients?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => setClients(Array.isArray(j.clients) ? j.clients : []))
      .catch(() => {});
  }, [load, slug]);

  // Apply the filter rail to the loaded preorders.
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const clientIds = Object.entries(selectedClients)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    return preorders.filter((p) => {
      if (view === "active" && p.status !== "open") return false;
      if (view === "ready" && p.status !== "open") return false;
      if (from && p.dueDate && p.dueDate < from) return false;
      if (to && p.dueDate && p.dueDate > to) return false;
      if (clientIds.length > 0 && !clientIds.includes(p.clientId)) return false;
      if (term) {
        const hay = `${p.clientName} ${p.productName} ${p.id}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [preorders, view, from, to, selectedClients, q]);

  // KPIs derived from the full preorders set (mirrors the PHP summary tiles).
  const openCount = useMemo(() => preorders.filter((p) => p.status === "open").length, [preorders]);
  const pieces = useMemo(
    () => preorders.filter((p) => p.status === "open").reduce((sum, p) => sum + (p.quantity || 0), 0),
    [preorders],
  );

  const selectedLocationName =
    locationId !== "0" ? locations.find((l) => String(l.id) === locationId)?.name ?? "" : "";

  const visibleClients = useMemo(() => {
    const term = clientFilter.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => String(c.name ?? "").toLowerCase().includes(term));
  }, [clients, clientFilter]);

  function resetFilters() {
    setFrom("");
    setTo("");
    setLocationId("0");
    setQ("");
    setClientFilter("");
    setSelectedClients({});
    setView("active");
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/pos_preorders.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Pagamenti</div>
          <h1 className="bs-page-title">Preordini</h1>
          <div className="bs-page-subtitle">
            Prodotti venduti da Pagamenti con stato Ordinato. Il ritiro si registra dal Dettaglio vendita.
          </div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap">
            <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=pos_settings`}>
              <i className="bi bi-gear me-1" />
              Impostazioni
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Preordini aperti</div>
            <div className="h3 fw-semibold mb-0">{openCount}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Pezzi da consegnare</div>
            <div className="h3 fw-semibold mb-0">{pieces}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Pronti al ritiro</div>
            <div className="h3 fw-semibold mb-0 text-success">0</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card p-3 h-100">
            <div className="small text-muted">Con stock insufficiente</div>
            <div className="h3 fw-semibold mb-0 ">0</div>
          </div>
        </div>
      </div>

      <div className="pos-movements-layout">
        <div className="card pos-movements-filter preorders-filter-card">
          <form
            method="get"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input type="hidden" name="page" value="pos_preorders" />

            <div className="pos-filter-head">
              <div>
                <div className="fw-semibold">Filtri</div>
                <div className="text-muted small">Preordini</div>
              </div>
              <a
                className="btn btn-sm btn-outline-secondary"
                href={`/${encodeURIComponent(slug)}/index.php?page=pos_preorders`}
                title="Azzera filtri"
                onClick={(e) => {
                  e.preventDefault();
                  resetFilters();
                }}
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
              <label className="pos-filter-title" htmlFor="preordersLocation">
                Sede
              </label>
              <select
                id="preordersLocation"
                name="location_id"
                className="form-select form-select-sm"
                data-autosubmit="1"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="0">Tutte</option>
                {locations.map((loc) => (
                  <option value={String(loc.id)} key={loc.id}>
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
                placeholder="Cliente, prodotto, SKU, vendita..."
              />
            </div>

            <div className="pos-filter-block">
              <div className="pos-filter-title">Filtri attivi</div>
              <div className="pos-active-filters">
                {selectedLocationName ? (
                  <span className="badge text-bg-light border">Sede: {selectedLocationName}</span>
                ) : null}
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
                    data-filter-target="#preordersClientList"
                    placeholder="Filtra clienti"
                    autoComplete="off"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                  />
                </div>
                <div className="pos-filter-check-list" id="preordersClientList">
                  {visibleClients.map((c) => (
                    <label
                      className="pos-filter-check"
                      data-filter-option
                      data-filter-text={String(c.name ?? "").toLowerCase()}
                      key={c.id}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="client_id[]"
                        value={String(c.id)}
                        checked={!!selectedClients[c.id]}
                        onChange={(e) =>
                          setSelectedClients((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Prodotti</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="text-muted small">Nessun prodotto disponibile.</div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Vista</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="pos-filter-check-list">
                  {[
                    { value: "active", label: "Aperti" },
                    { value: "ready", label: "Pronti al ritiro" },
                    { value: "not_ready", label: "Stock insufficiente / parziale" },
                    { value: "expired", label: "Scaduti" },
                    { value: "sale", label: "Solo ordinati" },
                    { value: "package", label: "Solo pacchetti" },
                    { value: "giftbox", label: "Solo GiftBox" },
                    { value: "all", label: "Tutti" },
                  ].map((opt) => (
                    <label className="pos-filter-check" key={opt.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="view"
                        value={opt.value}
                        checked={view === opt.value}
                        onChange={() => setView(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
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
                    <th className="pos-preorders-col-purchase">Acquisto</th>
                    <th className="pos-preorders-col-sale">Vendita</th>
                    <th className="pos-preorders-col-type">Tipo</th>
                    <th className="pos-preorders-col-client">Cliente</th>
                    <th>Prodotto</th>
                    <th className="text-end pos-preorders-col-qty">Q.tà</th>
                    <th className="text-end pos-preorders-col-stock">Stock</th>
                    <th className="pos-preorders-col-status">Stato</th>
                    <th className="text-end pos-preorders-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        {loading
                          ? "Caricamento…"
                          : "Nessun prodotto da consegnare trovato con i filtri selezionati."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id}>
                        <td className="pos-preorders-col-purchase">{fmtDate(p.createdAt)}</td>
                        <td className="pos-preorders-col-sale">
                          <a href={`/${encodeURIComponent(slug)}/index.php?page=pos_sales&action=view&id=${p.id}`}>
                            #{p.id}
                          </a>
                        </td>
                        <td className="pos-preorders-col-type">—</td>
                        <td className="pos-preorders-col-client">{p.clientName || "—"}</td>
                        <td>{p.productName}</td>
                        <td className="text-end pos-preorders-col-qty">{p.quantity}</td>
                        <td className="text-end pos-preorders-col-stock">—</td>
                        <td className="pos-preorders-col-status">
                          {p.status === "collected" ? (
                            <span className="badge text-bg-success">Ritirato</span>
                          ) : (
                            <span className="badge text-bg-warning text-dark">Ordinato</span>
                          )}
                        </td>
                        <td className="text-end pos-preorders-col-actions">
                          <a
                            className="btn btn-sm btn-outline-secondary"
                            href={`/${encodeURIComponent(slug)}/index.php?page=pos_sales&action=view&id=${p.id}`}
                          >
                            Dettaglio
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
