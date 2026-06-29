"use client";

import { useEffect, useState } from "react";

// Pixel-faithful port of the PHP fidelity settings page (app/pages/fidelity.php).
// The page is a single "Impostazione generale" card with a global on/off switch.
// The toggle state mirrors the businesses.fidelity_enabled flag, which the
// /api/manage/configuration?module=fidelity_membership endpoint exposes as the
// "Programma fidelity" record (active = enabled).

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

type ConfigRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt?: string;
};

export function FidelityContent() {
  const slug = tenantSlug();
  // Default to the captured PHP state (checked) until the API resolves.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`/api/manage/configuration?module=fidelity_membership&slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const records: ConfigRecord[] = Array.isArray(j.records) ? j.records : [];
        const program = records.find((rec) => rec.id === 1 || rec.title === "Programma fidelity");
        if (program) setEnabled(Boolean(program.active));
      })
      .catch(() => {});
  }, [slug]);

  const pageHref = `/${encodeURIComponent(slug)}/index.php?page=fidelity`;

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/fidelity.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelizzazione</div>
          <h1 className="bs-page-title">Fidelity</h1>
          <div className="bs-page-subtitle">Gestisci impostazioni generali e collegamenti del programma Fidelity.</div>
        </div>
      </div>

      <div className="card p-4 mb-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="h5 fw-bold mb-1">Impostazione generale</div>
            <div className="text-muted small">
              Abilita o disabilita l&apos;intera funzione Fidelity. Quando &egrave; disattiva, le sezioni operative Fidelity
              vengono disabilitate; Ricariche e Portafoglio credito restano disponibili.
            </div>
          </div>
          <form method="post" action={pageHref} className="d-flex align-items-center gap-3" id="fidToggleForm">
            <input type="hidden" name="_mode" value="toggle_fidelity" />
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="fidEnabledGlobal"
                name="fidelity_enabled"
                value="1"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label className="form-check-label fw-semibold" htmlFor="fidEnabledGlobal">
                Attivo
              </label>
            </div>
            <button className="btn btn-primary btn-pill" type="submit">
              <i className="bi bi-check2-circle me-1" />
              Salva
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
