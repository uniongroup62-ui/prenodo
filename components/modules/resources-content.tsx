"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP resources page (app/pages/resources.php).
type Row = Record<string, unknown>;

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function ResourcesContent() {
  const slug = tenantSlug();
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/manage/resources?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => {
        const list = j.resources ?? j.records ?? j.items ?? [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/resources.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Risorse</div>
          <h1 className="bs-page-title">Risorse</h1>
          <div className="bs-page-subtitle">
            Gestisci le risorse condivise con una quantita massima disponibile contemporaneamente.
          </div>
        </div>
        <div className="bs-page-actions" />
      </div>

      {items.length === 0 ? (
        <div className="card resources-empty-card">
          <div className="resources-empty-state">
            <div className="resources-empty-icon" aria-hidden="true">
              <i className="bi bi-tools" />
            </div>
            <h2>Nessuna risorsa configurata</h2>
            <p>
              Le risorse servono per macchinari, dispositivi o dotazioni condivise con disponibilità
              limitata. Creane una solo se un servizio deve bloccare una risorsa.
            </p>
            <a className="btn btn-primary btn-pill" href={`/${encodeURIComponent(slug)}/resources?action=new`}>
              <i className="bi bi-plus-lg me-1" />
              Nuova risorsa
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Risorsa</th>
                  <th>Quantità</th>
                  <th>Sede</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={String(r.id ?? i)}>
                    <td className="fw-semibold">{String(r.name ?? "")}</td>
                    <td>{String(r.quantity ?? r.qty ?? "—")}</td>
                    <td className="text-muted small">{String(r.locationName ?? r.location_name ?? "")}</td>
                    <td className="text-end">
                      <a
                        className="btn btn-sm btn-outline-secondary"
                        href={`/${encodeURIComponent(slug)}/resources?action=edit&id=${String(r.id ?? "")}`}
                      >
                        Modifica
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
