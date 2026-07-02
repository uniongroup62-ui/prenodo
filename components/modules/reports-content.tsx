"use client";

import { useCallback, useEffect, useState } from "react";

// Pixel-faithful port of the PHP reports page (app/pages/reports.php,
// ?page=reports). The original is a read-only analytics dashboard (filter
// form, KPI tiles, Chart.js canvases and "more" modals). It is fed by the
// existing DB-backed /api/manage/reports endpoint, which currently exposes a
// subset of the KPIs the PHP page renders. Values present in the API are
// pre-filled on mount; values not exposed by the API fall back to the PHP
// "empty" defaults ("0", "€ 0,00", "—", "N/D", "Non indicato").

type ReportRow = { name: string; revenue: number; qty?: number; saleCount?: number };
type Analytics = {
  from: string;
  to: string;
  summary: { soldRevenue: number; grossRevenue: number; saleCount: number; servedClients: number; averageTicket: number; appointmentCount: number };
  comparison: { from: string; to: string; soldRevenue: number; saleCount: number; deltaPct: number } | null;
  daily: { day: string; revenue: number; saleCount: number }[];
  topClients: { clientId: number; name: string; revenue: number; saleCount: number }[];
  topServices: ReportRow[];
  topProducts: ReportRow[];
  operators: { name: string; revenue: number; saleCount: number }[];
};

type ReportsResponse = {
  ok?: boolean;
  kpis?: {
    activeSales?: number;
    revenue?: number;
    cancelledRevenue?: number;
    averageTicket?: number;
    clients?: number;
    lowStock?: number;
  };
  paymentTotals?: Record<string, number>;
  mix?: { services?: number; products?: number };
  analytics?: Analytics;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtMoney(n: number | undefined): string {
  // Italian number_format($n, 2, ',', '.') -> "€ 0,00"
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return `€ ${v.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtInt(n: number | undefined): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return String(v);
}

export function ReportsContent() {
  const slug = tenantSlug();

  // Filter form state (keeps the GET form interactive; mirrors PHP defaults).
  const [range, setRange] = useState("month_current");
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-06-29");
  const [granularity, setGranularity] = useState("auto");
  const [compare, setCompare] = useState(false);
  const [compareMode, setCompareMode] = useState("auto");
  const [compareMonth, setCompareMonth] = useState("2026-05");
  const [compareFrom, setCompareFrom] = useState("2026-05-01");
  const [compareTo, setCompareTo] = useState("2026-05-29");

  const [data, setData] = useState<ReportsResponse | null>(null);

  // Resolve the range preset (or custom from/to) to a [from, to] window (YYYY-MM-DD),
  // mirroring reports.php's period presets. Uses UTC to match the server's date math.
  const resolveRange = useCallback((): { from: string; to: string } => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const dayMs = 86400000;
    const back = (n: number) => iso(new Date(Date.UTC(y, m, d) - n * dayMs));
    switch (range) {
      case "today": return { from: iso(now), to: iso(now) };
      case "yesterday": return { from: back(1), to: back(1) };
      case "last_7": return { from: back(6), to: iso(now) };
      case "last_30": return { from: back(29), to: iso(now) };
      case "last_90": return { from: back(89), to: iso(now) };
      case "last_180": return { from: back(179), to: iso(now) };
      case "month_previous": return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
      case "year_current": return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(now) };
      case "custom": return { from, to };
      case "month_current":
      default: return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(now) };
    }
  }, [range, from, to]);

  const load = useCallback(() => {
    const rng = resolveRange();
    const params = new URLSearchParams({ slug, from: rng.from, to: rng.to });
    if (compare) params.set("compare", "1");
    return fetch(`/api/manage/reports?${params.toString()}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: ReportsResponse) => setData(j))
      .catch(() => setData(null));
  }, [slug, resolveRange, compare]);

  useEffect(() => {
    load();
  }, [load]);

  const k = data?.kpis ?? {};
  const a = data?.analytics;
  const showCustom = range === "custom";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/reports.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Analisi</div>
          <h1 className="bs-page-title">Report</h1>
          <div className="bs-page-subtitle">{a ? `Periodo ${a.from.split("-").reverse().join("/")} – ${a.to.split("-").reverse().join("/")}` : "Statistiche vendite del periodo"}</div>
        </div>
      </div>

      <div className="report-filter-card p-3 mb-3">
        <form
          method="get"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <input type="hidden" name="page" value="reports" />
          <div className="report-filter-grid">
            <div className="report-filter-field">
              <label className="form-label small text-muted" htmlFor="reportRange">
                Periodo dati
              </label>
              <select
                className="form-select"
                name="range"
                id="reportRange"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="today">Oggi</option>
                <option value="yesterday">Ieri</option>
                <option value="last_7">Ultimi 7 giorni</option>
                <option value="last_30">Ultimi 30 giorni</option>
                <option value="last_90">Ultimi 90 giorni</option>
                <option value="last_180">Ultimi 180 giorni</option>
                <option value="month_current">Mese corrente</option>
                <option value="month_previous">Mese precedente</option>
                <option value="year_current">Anno corrente</option>
                <option value="custom">Personalizzato</option>
              </select>
            </div>
            <div className={`report-filter-field${showCustom ? "" : " d-none"}`} data-report-custom-group>
              <label className="form-label small text-muted">Dal</label>
              <input
                className="form-control"
                type="date"
                name="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-report-custom-date
              />
            </div>
            <div className={`report-filter-field${showCustom ? "" : " d-none"}`} data-report-custom-group>
              <label className="form-label small text-muted">Al</label>
              <input
                className="form-control"
                type="date"
                name="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-report-custom-date
              />
            </div>
            <div className="report-filter-field">
              <label className="form-label small text-muted" htmlFor="reportGranularity">
                Raggruppamento grafici
              </label>
              <select
                className="form-select"
                name="granularity"
                id="reportGranularity"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
              >
                <option value="auto">Automatico</option>
                <option value="daily">Per giorno</option>
                <option value="weekly">Per settimana</option>
                <option value="monthly">Per mese</option>
              </select>
            </div>
            <div className="report-filter-actions">
              <div className="form-check report-filter-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="compare"
                  value="1"
                  id="reportCompare"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold" htmlFor="reportCompare">
                  Confronta
                </label>
              </div>
              <button className="btn btn-outline-primary w-100" type="submit">
                <i className="bi bi-arrow-clockwise me-1" />
                Aggiorna
              </button>
            </div>
          </div>

          <div
            className="report-filter-summary report-filter-summary-bar mt-2"
            data-report-period-summary
            data-from="2026-06-01"
            data-to="2026-06-29"
          >
            <span>
              Periodo selezionato: <strong data-report-period-label>01/06/2026 - 29/06/2026</strong>
            </span>
            <span>Raggruppamento automatico</span>
          </div>

          <div className={`report-filter-section${compare ? "" : " d-none"}`} data-report-compare-panel>
            <div className="report-filter-grid is-compare">
              <div className="report-filter-field">
                <label className="form-label small text-muted" htmlFor="reportCompareMode">
                  Confronta con
                </label>
                <select
                  className="form-select"
                  name="compare_mode"
                  id="reportCompareMode"
                  value={compareMode}
                  onChange={(e) => setCompareMode(e.target.value)}
                >
                  <option value="auto">Automatico</option>
                  <option value="previous_period">Stesso periodo precedente</option>
                  <option value="previous_year">Stesso periodo anno precedente</option>
                  <option value="month">Scegli mese</option>
                  <option value="custom">Periodo personalizzato</option>
                </select>
              </div>
              <div
                className={`report-filter-field${compareMode === "month" ? "" : " d-none"}`}
                data-report-compare-month
              >
                <label className="form-label small text-muted">Mese confronto</label>
                <input
                  className="form-control"
                  type="month"
                  name="compare_month"
                  value={compareMonth}
                  onChange={(e) => setCompareMonth(e.target.value)}
                  data-report-compare-month-input
                />
              </div>
              <div
                className={`report-filter-field${compareMode === "custom" ? "" : " d-none"}`}
                data-report-compare-custom
              >
                <label className="form-label small text-muted">Confronto dal</label>
                <input
                  className="form-control"
                  type="date"
                  name="compare_from"
                  value={compareFrom}
                  onChange={(e) => setCompareFrom(e.target.value)}
                  data-report-compare-custom-date
                />
              </div>
              <div
                className={`report-filter-field${compareMode === "custom" ? "" : " d-none"}`}
                data-report-compare-custom
              >
                <label className="form-label small text-muted">Confronto al</label>
                <input
                  className="form-control"
                  type="date"
                  name="compare_to"
                  value={compareTo}
                  onChange={(e) => setCompareTo(e.target.value)}
                  data-report-compare-custom-date
                />
              </div>
              <div className="report-filter-summary align-self-end pb-2">
                Confronto effettivo: <strong data-report-compare-effective>01/05/2026 - 29/05/2026</strong>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="report-kpi-grid mb-3">
        <div className="report-kpi">
          <div className="label">Incasso</div>
          <div className="value">{fmtMoney(a?.summary.soldRevenue)}</div>
          <div className="sub">
            Venduto {fmtMoney(a?.summary.soldRevenue)} / Lordo {fmtMoney(a?.summary.grossRevenue)}
          </div>
          {a?.comparison ? (
            <div className={`sub ${a.comparison.deltaPct >= 0 ? "text-success" : "text-danger"}`}>
              {a.comparison.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(a.comparison.deltaPct)}% vs periodo prec. ({fmtMoney(a.comparison.soldRevenue)})
            </div>
          ) : null}
        </div>
        <div className="report-kpi">
          <div className="label">Vendite</div>
          <div className="value">{fmtInt(a?.summary.saleCount)}</div>
          <div className="sub">Periodo selezionato</div>
        </div>
        <div className="report-kpi">
          <div className="label">Scontrino medio</div>
          <div className="value">{fmtMoney(a?.summary.averageTicket)}</div>
          <div className="sub">Periodo selezionato</div>
        </div>
        <div className="report-kpi">
          <div className="label">Clienti serviti</div>
          <div className="value">{fmtInt(a?.summary.servedClients)}</div>
          <div className="sub">Clienti associati alle vendite</div>
        </div>
      </div>

      <div className="report-kpi-grid mb-3">
        <div className="report-kpi">
          <div className="label">Prenotazioni</div>
          <div className="value">{fmtInt(a?.summary.appointmentCount)}</div>
          <div className="sub">Non annullate nel periodo</div>
        </div>
        <div className="report-kpi">
          <div className="label">Clienti in archivio</div>
          <div className="value">{fmtInt(k.clients)}</div>
          <div className="sub">Profilo clienti sede1</div>
        </div>
        <div className="report-kpi">
          <div className="label">Genere prevalente</div>
          <div className="value">Non indicato</div>
          <div className="sub">Donne 0 / Uomini 0 / Non indicato {fmtInt(k.clients)}</div>
          <div className="sub">Nessun genere indicato</div>
        </div>
        <div className="report-kpi">
          <div className="label">Et&agrave; media</div>
          <div className="value">N/D</div>
          <div className="sub">Con data 0 / Senza data {fmtInt(k.clients)}</div>
        </div>
      </div>

      <div className="report-kpi-grid mb-3">
        <div className="report-kpi">
          <div className="label">Costi</div>
          <div className="value">€ 0,00</div>
          <div className="sub">Residuo € 0,00</div>
        </div>
        <div className="report-kpi">
          <div className="label">Commissioni</div>
          <div className="value">€ 0,00</div>
          <div className="sub">Da pagare € 0,00</div>
        </div>
      </div>

      {/* Date-filtered analytics (top clients / operators / services / products + daily trend). */}
      <div className="row g-3 mb-3">
        <div className="col-xl-6">
          <div className="report-panel p-3">
            <div className="fw-semibold mb-2">Migliori clienti</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Cliente</th><th className="text-end">Vendite</th><th className="text-end">Incasso</th></tr></thead>
                <tbody>
                  {(a?.topClients ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-2">Nessun dato nel periodo.</td></tr>
                  ) : (
                    (a?.topClients ?? []).map((c) => (
                      <tr key={c.clientId}><td>{c.name}</td><td className="text-end">{c.saleCount}</td><td className="text-end">{fmtMoney(c.revenue)}</td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="report-panel p-3">
            <div className="fw-semibold mb-2">Operatori</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Operatore</th><th className="text-end">Vendite</th><th className="text-end">Incasso</th></tr></thead>
                <tbody>
                  {(a?.operators ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-2">Nessun dato nel periodo.</td></tr>
                  ) : (
                    (a?.operators ?? []).map((o) => (
                      <tr key={o.name}><td>{o.name}</td><td className="text-end">{o.saleCount}</td><td className="text-end">{fmtMoney(o.revenue)}</td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="report-panel p-3">
            <div className="fw-semibold mb-2">Servizi più venduti</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Servizio</th><th className="text-end">Qtà</th><th className="text-end">Incasso</th></tr></thead>
                <tbody>
                  {(a?.topServices ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-2">Nessun dato nel periodo.</td></tr>
                  ) : (
                    (a?.topServices ?? []).map((s) => (
                      <tr key={s.name}><td>{s.name}</td><td className="text-end">{s.qty ?? 0}</td><td className="text-end">{fmtMoney(s.revenue)}</td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="report-panel p-3">
            <div className="fw-semibold mb-2">Prodotti più venduti</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Prodotto</th><th className="text-end">Qtà</th><th className="text-end">Incasso</th></tr></thead>
                <tbody>
                  {(a?.topProducts ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-2">Nessun dato nel periodo.</td></tr>
                  ) : (
                    (a?.topProducts ?? []).map((s) => (
                      <tr key={s.name}><td>{s.name}</td><td className="text-end">{s.qty ?? 0}</td><td className="text-end">{fmtMoney(s.revenue)}</td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="report-panel p-3">
            <div className="fw-semibold mb-2">Andamento incasso per giorno</div>
            <div className="table-responsive" style={{ maxHeight: 240, overflowY: "auto" }}>
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Giorno</th><th className="text-end">Vendite</th><th className="text-end">Incasso</th></tr></thead>
                <tbody>
                  {(a?.daily ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-2">Nessuna vendita nel periodo.</td></tr>
                  ) : (
                    (a?.daily ?? []).map((row) => {
                      const [yy, mm, dd] = row.day.split("-");
                      return (<tr key={row.day}><td>{dd}/{mm}/{yy}</td><td className="text-end">{row.saleCount}</td><td className="text-end">{fmtMoney(row.revenue)}</td></tr>);
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Andamento incasso</div>
              <span className="badge text-bg-light">Per giorno</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportTrendChart" aria-label="Andamento incasso" />
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Andamento prenotazioni</div>
              <span className="badge text-bg-light">Per giorno</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportAppointmentsTrendChart" aria-label="Andamento prenotazioni" />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-3 col-md-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Tipologie di vendita</div>
              <span className="badge text-bg-light">Tipologia</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportSalesTypesChart" aria-label="Tipologie di vendita" />
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-md-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Metodi di pagamento</div>
              <span className="badge text-bg-light">Importi</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportPaymentMethodsChart" aria-label="Metodi di pagamento" />
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-md-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Clienti per genere</div>
              <span className="badge text-bg-light">Archivio</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportGenderChart" aria-label="Clienti per genere" />
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-md-6">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Clienti per et&agrave;</div>
              <span className="badge text-bg-light">Fasce</span>
            </div>
            <div className="report-chart-wrap">
              <canvas id="reportAgeChart" aria-label="Clienti per eta" />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-4">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Top clienti</div>
              <div className="report-section-actions">
                <span className="badge text-bg-light">Top 10</span>
              </div>
            </div>
            <div className="report-chart-wrap is-compact is-top10">
              <canvas id="reportClientsChart" aria-label="Top clienti" />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Top servizi e prodotti</div>
              <div className="report-section-actions">
                <span className="badge text-bg-light">Top 10</span>
              </div>
            </div>
            <div className="report-chart-wrap is-compact is-top10">
              <canvas id="reportItemsChart" aria-label="Top servizi e prodotti" />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Operatori</div>
              <div className="report-section-actions">
                <span className="badge text-bg-light">Top 10</span>
              </div>
            </div>
            <div className="report-chart-wrap is-compact is-top10">
              <canvas id="reportOperatorsChart" aria-label="Operatori" />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <div className="report-panel">
            <div className="report-section-title border-bottom">
              <div className="fw-semibold">Incasso e costi</div>
              <span className="badge text-bg-light">Periodo</span>
            </div>
            <div className="report-finance-layout">
              <div className="report-chart-wrap is-compact">
                <canvas id="reportFinanceChart" aria-label="Incasso e costi" />
              </div>
              <div className="report-finance-summary">
                <div className="report-finance-line">
                  <div>
                    <div className="report-finance-label">Incasso</div>
                    <div className="report-finance-sub">
                      Movimenti {fmtInt(k.activeSales)} / Venduto {fmtMoney(k.revenue)} / Scontrino medio{" "}
                      {fmtMoney(k.averageTicket)}
                    </div>
                  </div>
                  <div className="report-finance-value">{fmtMoney(k.revenue)}</div>
                </div>
                <div className="report-finance-line">
                  <div>
                    <div className="report-finance-label">Costi</div>
                    <div className="report-finance-sub">Pagato € 0,00 / Residuo € 0,00</div>
                  </div>
                  <div className="report-finance-value">€ 0,00</div>
                </div>
                <div className="report-finance-line">
                  <div>
                    <div className="report-finance-label">Commissioni</div>
                    <div className="report-finance-sub">Pagate € 0,00 / Da pagare € 0,00</div>
                  </div>
                  <div className="report-finance-value">€ 0,00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="modal fade report-more-modal"
        id="reportClientsModal"
        tabIndex={-1}
        aria-labelledby="reportClientsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title" id="reportClientsModalLabel">
                  Top clienti
                </h5>
                <div className="small text-muted" data-report-modal-count>
                  0 risultati
                </div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className="report-modal-search mb-3">
                <label className="form-label small text-muted" htmlFor="reportClientsSearch">
                  Cerca cliente
                </label>
                <input
                  className="form-control"
                  id="reportClientsSearch"
                  type="search"
                  placeholder="Nome cliente..."
                  data-report-modal-search
                />
              </div>
              <div className="report-modal-table-wrap">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th className="text-muted">#</th>
                      <th>Cliente</th>
                      <th className="text-end">Vendite</th>
                      <th className="text-end">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="d-none" data-report-modal-empty>
                      <td colSpan={4} className="text-muted p-3">
                        Nessun risultato trovato.
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-muted p-3">
                        Nessun dato.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="modal fade report-more-modal"
        id="reportItemsModal"
        tabIndex={-1}
        aria-labelledby="reportItemsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title" id="reportItemsModalLabel">
                  Top servizi e prodotti
                </h5>
                <div className="small text-muted" data-report-modal-count>
                  0 risultati
                </div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className="report-modal-search mb-3">
                <label className="form-label small text-muted" htmlFor="reportItemsSearch">
                  Cerca servizio o prodotto
                </label>
                <input
                  className="form-control"
                  id="reportItemsSearch"
                  type="search"
                  placeholder="Nome, tipo..."
                  data-report-modal-search
                />
              </div>
              <div className="report-modal-table-wrap">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th className="text-muted">#</th>
                      <th>Voce</th>
                      <th>Tipo</th>
                      <th className="text-end">Quantità</th>
                      <th className="text-end">Vendite</th>
                      <th className="text-end">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="d-none" data-report-modal-empty>
                      <td colSpan={6} className="text-muted p-3">
                        Nessun risultato trovato.
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="text-muted p-3">
                        Nessun dato.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="modal fade report-more-modal"
        id="reportOperatorsModal"
        tabIndex={-1}
        aria-labelledby="reportOperatorsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title" id="reportOperatorsModalLabel">
                  Operatori
                </h5>
                <div className="small text-muted" data-report-modal-count>
                  0 risultati
                </div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className="report-modal-search mb-3">
                <label className="form-label small text-muted" htmlFor="reportOperatorsSearch">
                  Cerca operatore
                </label>
                <input
                  className="form-control"
                  id="reportOperatorsSearch"
                  type="search"
                  placeholder="Nome operatore..."
                  data-report-modal-search
                />
              </div>
              <div className="report-modal-table-wrap">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th className="text-muted">#</th>
                      <th>Operatore</th>
                      <th className="text-end">Ore lavorate</th>
                      <th className="text-end">App.</th>
                      <th className="text-end">Vendite</th>
                      <th className="text-end">Scontrino medio</th>
                      <th className="text-end">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="d-none" data-report-modal-empty>
                      <td colSpan={7} className="text-muted p-3">
                        Nessun risultato trovato.
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="text-muted p-3">
                        Nessun dato.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
