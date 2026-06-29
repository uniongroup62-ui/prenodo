"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP giftbox page (app/pages/giftbox.php).
type Row = Record<string, unknown>;

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function GiftboxContent() {
  const slug = tenantSlug();
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/manage/giftboxes?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => {
        const list = j.giftboxes ?? j.instances ?? j.records ?? j.items ?? [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [slug]);

  const settingsHref = `/${encodeURIComponent(slug)}/index.php?page=giftbox_settings`;

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/giftbox.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Programma fedelta</div>
          <h1 className="bs-page-title">Fidelity / GiftBox</h1>
          <div className="bs-page-subtitle">Gestisci template, voucher e GiftBox emesse.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-outline-secondary btn-pill" href={`/${encodeURIComponent(slug)}/index.php?page=fidelity`}>
              <i className="bi bi-arrow-left me-1" />
              Fidelity
            </a>
            <a className="btn btn-outline-secondary btn-pill" href={settingsHref}>
              <i className="bi bi-gear me-1" />
              Impostazioni
            </a>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card border-0 shadow-sm giftbox-empty-card">
          <div className="giftbox-empty-state">
            <div className="giftbox-empty-icon" aria-hidden="true">
              <i className="bi bi-gift" />
            </div>
            <h2>Nessuna GiftBox presente</h2>
            <p>
              Le GiftBox emesse da Pagamenti compariranno qui. Potrai monitorare mittente, destinatario,
              scadenze, riscatti e sede di emissione.
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <a className="btn btn-primary" href={`/${encodeURIComponent(slug)}/index.php?page=pos`}>
                <i className="bi bi-plus-lg me-1" />
                Crea GiftBox
              </a>
              <a className="btn btn-outline-secondary" href={settingsHref}>
                <i className="bi bi-gear me-1" />
                Impostazioni
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
                  <th>Codice</th>
                  <th>Destinatario</th>
                  <th>Stato</th>
                  <th>Scadenza</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={String(r.id ?? r.code ?? i)}>
                    <td className="fw-semibold">{String(r.code ?? r.id ?? "")}</td>
                    <td>{String(r.recipientName ?? r.recipient ?? "—")}</td>
                    <td>{String(r.status ?? "")}</td>
                    <td className="text-muted small">{String(r.expiresAt ?? r.expiry ?? "—")}</td>
                    <td className="text-end">
                      <a
                        className="btn btn-sm btn-outline-secondary"
                        href={`/${encodeURIComponent(slug)}/index.php?page=giftbox&action=view&id=${String(r.id ?? "")}`}
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
