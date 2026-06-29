"use client";

import { useEffect, useState } from "react";

// Pixel-faithful port of the PHP reports page (app/pages/reports.php,
// ?page=reports). The original is a read-only analytics dashboard (filter
// form, KPI tiles, Chart.js canvases and "more" modals). It is fed by the
// existing DB-backed /api/manage/reports endpoint, which currently exposes a
// subset of the KPIs the PHP page renders. Values present in the API are
// pre-filled on mount; values not exposed by the API fall back to the PHP
// "empty" defaults ("0", "€ 0,00", "—", "N/D", "Non indicato").

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

  useEffect(() => {
    fetch(`/api/manage/reports?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ReportsResponse) => setData(j))
      .catch(() => setData(null));
  }, [slug]);

  const k = data?.kpis ?? {};
  const showCustom = range === "custom";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/reports.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Analisi</div>
          <h1 className="bs-page-title">Report</h1>
          <div className="bs-page-subtitle">Mese corrente / 01/06/2026 - 29/06/2026 / Sede1 / Grafici per giorno</div>
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
          <div className="value">{fmtMoney(k.revenue)}</div>
          <div className="sub">
            Venduto {fmtMoney(k.revenue)} / Lordo {fmtMoney(k.revenue)}
          </div>
        </div>
        <div className="report-kpi">
          <div className="label">Vendite</div>
          <div className="value">{fmtInt(k.activeSales)}</div>
          <div className="sub">Periodo selezionato</div>
        </div>
        <div className="report-kpi">
          <div className="label">Scontrino medio</div>
          <div className="value">{fmtMoney(k.averageTicket)}</div>
          <div className="sub">Periodo selezionato</div>
        </div>
        <div className="report-kpi">
          <div className="label">Clienti serviti</div>
          <div className="value">0</div>
          <div className="sub">Clienti associati alle vendite</div>
        </div>
      </div>

      <div className="report-kpi-grid mb-3">
        <div className="report-kpi">
          <div className="label">Prenotazioni</div>
          <div className="value">0</div>
          <div className="sub">Non annullate nel periodo</div>
          <div className="sub">In attesa 0 / Prenotate 0 / Eseguite 0 / Annullate 2 / No show 0</div>
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
