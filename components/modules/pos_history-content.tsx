"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP movements page (app/pages/pos_history.php), fed by
// the existing DB-backed /api/manage/pos context (sales + catalog + locations).

type PosSale = {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  locationId: number;
  total: number;
  status: "active" | "cancelled";
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
};

type CatalogItem = { id: number; name: string };

type PosContext = {
  activeLocationId?: number;
  sales?: PosSale[];
  catalog?: {
    clients?: CatalogItem[];
    services?: CatalogItem[];
    products?: CatalogItem[];
  };
  locations?: Array<{ id: number; name: string }>;
};

const MOVEMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: "giftcard", label: "GiftCard" },
  { value: "recharge", label: "Ricarica" },
  { value: "giftbox", label: "GiftBox" },
];

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDateTime(value?: string): string {
  if (!value) return "—";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  const d = value.slice(0, 10);
  const [y, mo, day] = d.split("-");
  return day && mo && y ? `${day}/${mo}/${y}` : value;
}

function fmtMoney(value: number): string {
  return `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function PosHistoryContent() {
  const slug = tenantSlug();

  const [ctx, setCtx] = useState<PosContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state (kept working client-side over the loaded sales).
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saleNumber, setSaleNumber] = useState("");
  const [clientIds, setClientIds] = useState<Set<string>>(new Set());
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());
  const [movementTypes, setMovementTypes] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: PosContext) => setCtx(j ?? null))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const clients = ctx?.catalog?.clients ?? [];
  const services = ctx?.catalog?.services ?? [];
  const products = ctx?.catalog?.products ?? [];
  const locations = ctx?.locations ?? [];
  const sales = useMemo(() => ctx?.sales ?? [], [ctx]);

  const activeLocationName = useMemo(() => {
    const id = ctx?.activeLocationId;
    return locations.find((l) => l.id === id)?.name ?? "";
  }, [ctx, locations]);

  const locationById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const l of locations) map[l.id] = l.name;
    return map;
  }, [locations]);

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (saleNumber.trim()) {
        if (String(sale.id) !== saleNumber.trim()) return false;
      }
      if (clientIds.size > 0 && !clientIds.has(String(sale.clientId))) return false;
      const day = sale.createdAt?.slice(0, 10) ?? "";
      if (from && day && day < from) return false;
      if (to && day && day > to) return false;
      return true;
    });
  }, [sales, saleNumber, clientIds, from, to]);

  const visibleSales = filteredSales.slice(0, 200);

  const clientFilterText = clientSearch.trim().toLowerCase();
  const serviceFilterText = serviceSearch.trim().toLowerCase();

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/pos_history.css" />

      <div className="container-fluid">
        <div className="bs-page-header">
          <div className="bs-page-heading">
            <div className="bs-page-kicker">Pagamenti</div>
            <h1 className="bs-page-title">Movimenti</h1>
            <div className="bs-page-subtitle">
              Elenco degli elementi creati dalla pagina Pagamenti: vendite, ricariche, GiftBox e buoni.
            </div>
          </div>
          <div className="bs-page-actions">
            <div className="d-flex gap-2">
              <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=pos`}>
                <i className="bi bi-arrow-left"></i> Torna a Pagamenti
              </a>
            </div>
          </div>
        </div>

        <div className="pos-movements-layout">
          <form
            className="card pos-movements-filter"
            method="get"
            onSubmit={(e) => e.preventDefault()}
          >
            <input type="hidden" name="page" value="pos_history" />

            <div className="pos-filter-head">
              <div>
                <div className="fw-semibold">Filtri</div>
                <div className="text-muted small">Movimenti vendita</div>
              </div>
              <a
                className="btn btn-sm btn-outline-secondary"
                href={`/${encodeURIComponent(slug)}/index.php?page=pos_history`}
                title="Azzera filtri"
              >
                <i className="bi bi-arrow-counterclockwise"></i>
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
              <label className="pos-filter-title" htmlFor="posMovementSaleNumber">
                Numero vendita
              </label>
              <input
                id="posMovementSaleNumber"
                type="number"
                min={1}
                step={1}
                className="form-control form-control-sm"
                name="sale_number"
                value={saleNumber}
                onChange={(e) => setSaleNumber(e.target.value)}
                placeholder="Es. 237"
              />
            </div>

            <div className="pos-filter-block">
              <div className="pos-filter-title">Filtri attivi</div>
              <div className="pos-active-filters">
                {activeLocationName ? (
                  <span className="badge text-bg-light border">Sede: {activeLocationName}</span>
                ) : null}
              </div>
            </div>

            <details className="pos-filter-group" open>
              <summary>
                <span>Clienti</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="pos-filter-search-wrap">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    className="form-control form-control-sm pos-filter-search"
                    data-filter-target="#posMovClientList"
                    placeholder="Filtra clienti"
                    autoComplete="off"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>
                <div className="pos-filter-check-list" id="posMovClientList">
                  {clients.length === 0 ? (
                    <div className="text-muted small">Nessun cliente disponibile.</div>
                  ) : (
                    clients
                      .filter((c) => !clientFilterText || c.name.toLowerCase().includes(clientFilterText))
                      .map((c) => (
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
                            value={c.id}
                            checked={clientIds.has(String(c.id))}
                            onChange={() => toggle(clientIds, String(c.id), setClientIds)}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Servizi</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="text-muted small mb-2">Vendite che includono i servizi selezionati.</div>
                <div className="pos-filter-search-wrap">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    className="form-control form-control-sm pos-filter-search"
                    data-filter-target="#posMovServiceList"
                    placeholder="Filtra servizi"
                    autoComplete="off"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                </div>
                <div className="pos-filter-check-list" id="posMovServiceList">
                  {services.length === 0 ? (
                    <div className="text-muted small">Nessun servizio disponibile.</div>
                  ) : (
                    services
                      .filter((s) => !serviceFilterText || s.name.toLowerCase().includes(serviceFilterText))
                      .map((s) => (
                        <label
                          className="pos-filter-check"
                          data-filter-option
                          data-filter-text={s.name.toLowerCase()}
                          key={s.id}
                        >
                          <input
                            className="form-check-input"
                            type="checkbox"
                            name="service_id[]"
                            value={s.id}
                            checked={serviceIds.has(String(s.id))}
                            onChange={() => toggle(serviceIds, String(s.id), setServiceIds)}
                          />
                          <span>{s.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Prodotti</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="text-muted small mb-2">Vendite che includono i prodotti selezionati.</div>
                {products.length === 0 ? (
                  <div className="text-muted small">Nessun prodotto disponibile.</div>
                ) : (
                  <div className="pos-filter-check-list" id="posMovProductList">
                    {products.map((p) => (
                      <label
                        className="pos-filter-check"
                        data-filter-option
                        data-filter-text={p.name.toLowerCase()}
                        key={p.id}
                      >
                        <input className="form-check-input" type="checkbox" name="product_id[]" value={p.id} />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Pacchetti</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="text-muted small mb-2">Vendite che includono i pacchetti selezionati.</div>
                <div className="text-muted small">Nessun pacchetto disponibile.</div>
              </div>
            </details>

            <details className="pos-filter-group">
              <summary>
                <span>Tipologia</span>
              </summary>
              <div className="pos-filter-group-body">
                <div className="pos-filter-check-list">
                  {MOVEMENT_TYPES.map((mt) => (
                    <label className="pos-filter-check" key={mt.value}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="movement_type[]"
                        value={mt.value}
                        checked={movementTypes.has(mt.value)}
                        onChange={() => toggle(movementTypes, mt.value, setMovementTypes)}
                      />
                      <span>{mt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <div className="pos-filter-actions">
              <button className="btn btn-primary w-100" type="submit">
                <i className="bi bi-search"></i> Filtra
              </button>
            </div>
          </form>

          <section className="pos-movements-results">
            <div className="card p-3 mb-3 d-none">
              <form className="row g-2 align-items-end" method="get" onSubmit={(e) => e.preventDefault()}>
                <input type="hidden" name="page" value="pos_history" />

                <div className="col-12 col-lg-3">
                  <label className="form-label">Cliente</label>
                  <div className="app-combobox dropdown" id="posMovementClientFilterBox">
                    <button
                      className="btn btn-outline-secondary dropdown-toggle w-100 app-combobox-toggle"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <span className="app-combobox-text d-none"></span>
                      <span className="text-muted app-combobox-placeholder">Tutti</span>
                    </button>
                    <div className="dropdown-menu p-2 w-100">
                      <input
                        type="text"
                        className="form-control form-control-sm app-combobox-search"
                        placeholder="Cerca…"
                        autoComplete="off"
                      />
                      <div className="app-combobox-list mt-2"></div>
                    </div>
                    <input type="hidden" name="client_id" value="" />
                  </div>
                </div>

                <div className="col-12 col-md-6 col-lg-2">
                  <label className="form-label">Numero vendita</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="form-control"
                    name="sale_number"
                    value=""
                    readOnly
                    placeholder="Es. 237"
                  />
                </div>

                <div className="col-12 col-md-6 col-lg-2">
                  <label className="form-label">Servizio</label>
                  <select name="service_id" className="form-select" defaultValue="">
                    <option value="">Tutti</option>
                    {services.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label">Prodotto</label>
                  <select name="product_id" className="form-select" disabled defaultValue="">
                    <option value="">Tutti</option>
                    {products.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Da</label>
                  <input type="date" className="form-control" name="from" value="" readOnly />
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">A</label>
                  <input type="date" className="form-control" name="to" value="" readOnly />
                </div>

                <div className="col-12 col-md-3 col-lg-2 d-flex gap-2 align-items-end">
                  <button className="btn btn-primary w-100" type="submit">
                    <i className="bi bi-search"></i> Filtra
                  </button>
                  <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=pos_history`}>
                    <i className="bi bi-arrow-counterclockwise"></i>
                  </a>
                </div>
              </form>
            </div>

            <div className="card">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="pos-cronologia-sale-number-col">Numero vendita</th>
                      <th>Cliente</th>
                      <th className="pos-cronologia-location-col">Sede</th>
                      <th className="pos-cronologia-date-col">Data</th>
                      <th>Operatore</th>
                      <th className="text-end pos-cronologia-amount-col">Importo</th>
                      <th className="pos-cronologia-status-col">Stato</th>
                      <th className="text-end pos-cronologia-actions-col"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          {loading ? "Caricamento…" : "Nessun risultato."}
                        </td>
                      </tr>
                    ) : (
                      visibleSales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="pos-cronologia-sale-number-col">{sale.code || `#${sale.id}`}</td>
                          <td>{sale.clientName || "—"}</td>
                          <td className="pos-cronologia-location-col">{locationById[sale.locationId] ?? "—"}</td>
                          <td className="pos-cronologia-date-col">{fmtDateTime(sale.createdAt)}</td>
                          <td>—</td>
                          <td className="text-end pos-cronologia-amount-col">{fmtMoney(sale.total)}</td>
                          <td className="pos-cronologia-status-col">
                            {sale.status === "cancelled" ? (
                              <span className="badge text-bg-danger">Annullata</span>
                            ) : (
                              <span className="badge text-bg-success">Completata</span>
                            )}
                          </td>
                          <td className="text-end pos-cronologia-actions-col">
                            <a
                              className="btn btn-sm btn-outline-secondary"
                              href={`/${encodeURIComponent(slug)}/index.php?page=pos_sale_detail&id=${sale.id}`}
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

            <div className="text-muted small mt-2">Mostrati max 200 risultati (ordinati per data decrescente).</div>
          </section>
        </div>
      </div>
    </div>
  );
}
