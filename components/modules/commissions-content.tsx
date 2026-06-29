"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP commissions page (app/pages/commissions.php), fed by
// the existing DB-backed /api/manage/commissions. The live PHP renders the
// "Commissioni disattivate" empty state; when the API returns commission rows we
// fill an overview table with the real fields, otherwise we keep the verbatim
// empty card.

type CommissionStatus = "open" | "paid" | "reversed";

type Commission = {
  id: number;
  staffName: string;
  saleId?: number;
  appointmentId?: number;
  baseAmount: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt?: string;
};

type Summary = { open: number; paid: number; reversed: number; dueAmount: number };

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtEuro(n: number): string {
  return `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : "—";
}

function statusBadge(status: CommissionStatus): { label: string; cls: string } {
  if (status === "paid") return { label: "Pagata", cls: "text-bg-success" };
  if (status === "reversed") return { label: "Stornata", cls: "text-bg-secondary" };
  return { label: "Aperta", cls: "text-bg-warning" };
}

export function CommissionsContent() {
  const slug = tenantSlug();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<Summary>({ open: 0, paid: 0, reversed: 0, dueAmount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manage/commissions?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setCommissions(Array.isArray(j.commissions) ? j.commissions : []);
        if (j.summary) setSummary(j.summary as Summary);
      })
      .catch(() => {
        if (!cancelled) setCommissions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=commissions${suffix}`;
  }

  const hasRows = commissions.length > 0;

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/commissions.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Operatori</div>
          <h1 className="bs-page-title">Commissioni</h1>
          <div className="bs-page-subtitle">
            Collegato a Pagamenti, Quick Booking e Booking. Gli appuntamenti entrano in commissione quando risultano Eseguiti.
          </div>
        </div>
        <div className="bs-page-actions">
          {hasRows ? (
            <span className="badge text-bg-success">Commissioni attive</span>
          ) : (
            <span className="badge text-bg-secondary">Commissioni disattivate</span>
          )}
        </div>
      </div>

      <ul className="nav nav-tabs commissions-tabs mb-3">
        <li className="nav-item">
          <a className="nav-link active" href={href("&tab=overview")}>
            <i className="bi bi-graph-up me-1" />
            Riepilogo
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link " href={href("&tab=settings")}>
            <i className="bi bi-sliders me-1" />
            Impostazioni operatori
          </a>
        </li>
      </ul>

      {!loading && !hasRows ? (
        <div className="card border-0 shadow-sm commissions-empty-card">
          <div className="commissions-empty-state">
            <div className="commissions-empty-icon" aria-hidden="true">
              <i className="bi bi-percent" />
            </div>
            <h2>Funzione Commissioni disattivata</h2>
            <p>
              Le nuove vendite e i nuovi appuntamenti non generano movimenti commissione. Attiva la funzione e configura le
              percentuali quando vuoi iniziare a calcolarle.
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <a className="btn btn-primary" href={href("&tab=settings")}>
                <i className="bi bi-sliders me-1" />
                Attiva Commissioni
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-sm-6 col-xl-3">
              <div className="card p-3">
                <div className="text-muted small">Aperte</div>
                <div className="h4 fw-bold mb-0">{summary.open}</div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card p-3">
                <div className="text-muted small">Pagate</div>
                <div className="h4 fw-bold mb-0">{summary.paid}</div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card p-3">
                <div className="text-muted small">Stornate</div>
                <div className="h4 fw-bold mb-0">{summary.reversed}</div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card p-3">
                <div className="text-muted small">Da liquidare</div>
                <div className="h4 fw-bold mb-0">{fmtEuro(summary.dueAmount)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Operatore</th>
                    <th>Origine</th>
                    <th>Data</th>
                    <th className="text-end">Imponibile</th>
                    <th className="text-end">%</th>
                    <th className="text-end">Commissione</th>
                    <th>Stato</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasRows ? (
                    <tr>
                      <td colSpan={8} className="text-muted small p-3">
                        {loading ? "Caricamento…" : "Nessuna commissione."}
                      </td>
                    </tr>
                  ) : (
                    commissions.map((commission) => {
                      const badge = statusBadge(commission.status);
                      const origin = commission.saleId
                        ? `Vendita #${commission.saleId}`
                        : commission.appointmentId
                          ? `Appuntamento #${commission.appointmentId}`
                          : "—";
                      return (
                        <tr key={commission.id}>
                          <td className="fw-semibold">{commission.staffName}</td>
                          <td className="text-muted small">{origin}</td>
                          <td className="text-muted small">{fmtDate(commission.createdAt)}</td>
                          <td className="text-end">{fmtEuro(commission.baseAmount)}</td>
                          <td className="text-end">{commission.rate}%</td>
                          <td className="text-end fw-semibold">{fmtEuro(commission.amount)}</td>
                          <td>
                            <span className={`badge ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="text-end">
                            {commission.status === "open" ? (
                              <a className="btn btn-sm btn-primary" href={href(`&action=pay&id=${commission.id}`)}>
                                Liquida
                              </a>
                            ) : (
                              <span className="text-muted small">{fmtDate(commission.paidAt)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
