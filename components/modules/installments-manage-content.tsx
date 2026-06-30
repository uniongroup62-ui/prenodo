"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP installments page (app/pages/installments_manage.php).
type Row = Record<string, unknown>;

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function InstallmentsManageContent() {
  const slug = tenantSlug();
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/manage/installments?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => {
        const list = j.plans ?? j.installments ?? j.records ?? j.items ?? [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/installments_manage.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Pagamenti</div>
          <h1 className="bs-page-title">Gestione Rate</h1>
          <div className="bs-page-subtitle">Monitoraggio piani rateali, scadenze e incassi cliente.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/pos_history`}>
              <i className="bi bi-clock-history me-1" />
              Movimenti
            </a>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card border-0 shadow-sm installments-empty-card">
          <div className="installments-empty-state">
            <div className="installments-empty-icon" aria-hidden="true">
              <i className="bi bi-cash-stack" />
            </div>
            <h2>Nessun piano rateale presente</h2>
            <p>La gestione rate e ancora vuota. Crea una vendita con pagamento rateizzato per iniziare.</p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <a className="btn btn-primary" href={`/${encodeURIComponent(slug)}/pos`}>
                <i className="bi bi-credit-card me-1" />
                Nuova vendita
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Piano</th>
                  <th>Stato</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => (
                  <tr key={String(p.id ?? i)}>
                    <td className="fw-semibold">{String(p.clientName ?? p.client_name ?? "—")}</td>
                    <td>{String(p.label ?? p.id ?? "")}</td>
                    <td>{String(p.status ?? "")}</td>
                    <td className="text-end">
                      <a
                        className="btn btn-sm btn-outline-secondary"
                        href={`/${encodeURIComponent(slug)}/installments_manage?action=view&id=${String(p.id ?? "")}`}
                      >
                        Apri
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
