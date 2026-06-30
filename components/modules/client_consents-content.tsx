"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP per-client "Moduli consenso" page
// (app/pages/client_consents.php, ?page=client_consents&id=<clientId>).
//
// The page header (client name / phone / email) is fed by the existing
// DB-backed /api/manage/clients route, matched on the client id taken from the
// URL query string. The GDPR consent box and the associated/available consent
// modules do not yet have a dedicated Next.js API route, so the draft/empty
// state captured from the live PHP page is reproduced verbatim (the POST form
// targets the legacy index.php handler, exactly like the PHP page).

type Client = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function clientIdFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const raw = new URLSearchParams(window.location.search).get("id");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ClientConsentsContent() {
  const slug = tenantSlug();
  const [clientId, setClientId] = useState(0);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setClientId(clientIdFromUrl());
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/manage/clients?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const list: Client[] = Array.isArray(j.clients) ? j.clients : [];
        const found = list.find((c) => Number(c.id) === clientId) ?? null;
        setClient(found);
      })
      .catch(() => setClient(null))
      .finally(() => setLoading(false));
  }, [slug, clientId]);

  // Header strings, mirroring the PHP output. PHP renders the subtitle as
  // "<phone> - <email>" and leaves empty parts blank (e.g. "- - mario@test.it").
  const clientName = client?.name ?? "";
  const phone = client?.phone ?? "";
  const email = client?.email ?? "";
  const titleSuffix = clientName ? ` - ${clientName}` : "";

  // Legacy-style relative action links (the PHP page uses index.php?page=...).
  function pageHref(path: string): string {
    return `/${encodeURIComponent(slug)}/${`${path}`.replace("&", "?")}`;
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/client_consents.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Scheda cliente</div>
          <h1 className="bs-page-title">Moduli consenso{titleSuffix}</h1>
          <div className="bs-page-subtitle">
            {loading ? "—" : `${phone} - ${email}`}
          </div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            <a
              className="btn btn-outline-secondary"
              href={pageHref(`clients&action=view&id=${clientId}`)}
            >
              <i className="bi bi-arrow-left me-1" />
              Scheda cliente
            </a>
            <a
              className="btn btn-outline-primary"
              href={pageHref(`clients&action=history&id=${clientId}`)}
            >
              <i className="bi bi-clock-history me-1" />
              Storico
            </a>
          </div>
        </div>
      </div>

      <div className="consent-page-grid">
        <div className="consent-main-stack">
          <div className="card p-3 p-lg-4 consent-records-shell">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-journal-plus me-1" />
                  Associa modulo consenso
                </div>
                <div className="text-muted small">
                  Aggiungi al cliente un modulo attivo creato in Impostazioni &gt; Moduli consenso.
                </div>
              </div>
              <a className="btn btn-sm btn-outline-primary" href={pageHref("consent_modules")}>
                <i className="bi bi-gear me-1" />
                Gestisci moduli
              </a>
            </div>

            <div className="text-muted small">
              Nessun modulo attivo disponibile da associare: sono gia associati al cliente oppure
              non sono stati creati moduli aggiuntivi attivi.
            </div>
          </div>

          <div className="card p-3 p-lg-4 consent-records-shell">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-files me-1" />
                  Moduli consenso associati
                </div>
                <div className="text-muted small">
                  I moduli aggiuntivi sono ordinati per stato, cosi hai subito visibili quelli da
                  completare, quelli in attesa e quelli gia firmati.
                </div>
              </div>
              <span className="badge text-bg-light border consent-count-badge">
                0 modulo/i associato/i
              </span>
            </div>

            <div className="consent-empty-state">
              <div className="fs-5 mb-2">
                <i className="bi bi-journal-plus" />
              </div>
              <div className="fw-semibold mb-1">Nessun modulo consenso aggiuntivo associato</div>
              <div>Usa il riquadro in alto per associare un modulo attivo creato nel backend.</div>
            </div>
          </div>
        </div>

        <div className="consent-side-stack">
          <div className="card p-3 p-lg-4 gdpr-card consent-overview-card">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-shield-check me-1" />
                  GDPR
                </div>
                <div className="text-muted small">
                  Le spunte selezionate compilano automaticamente la sezione consenso del PDF privacy.
                </div>
              </div>
              <span className="badge text-bg-secondary">
                <i className="bi bi-file-earmark-text me-1" />
                Bozza
              </span>
            </div>

            <form
              method="post"
              action={pageHref(`client_consents&id=${clientId}`)}
              encType="multipart/form-data"
              className="gdpr-box"
            >
              <input type="hidden" name="_csrf" value="" />
              <input type="hidden" name="_mode" value="gdpr_action" />

              <div className="gdpr-checklist">
                <label className="gdpr-check-item">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="gdpr_consents[data_processing]"
                    value="1"
                  />
                  <span>Consenso al trattamento dei dati</span>
                </label>
                <label className="gdpr-check-item">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="gdpr_consents[communications]"
                    value="1"
                  />
                  <span>Consenso comunicazioni</span>
                </label>
                <label className="gdpr-check-item">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="gdpr_consents[marketing]"
                    value="1"
                  />
                  <span>Consenso marketing</span>
                </label>
                <label className="gdpr-check-item">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="gdpr_consents[data_sharing]"
                    value="1"
                  />
                  <span>Consenso diffusione dati</span>
                </label>
              </div>

              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  type="submit"
                  name="gdpr_action"
                  value="save_consents"
                >
                  <i className="bi bi-check2-circle me-1" />
                  Salva consensi
                </button>
              </div>

              <div className="small text-muted mt-3 consent-status-line">
                Stato bozza: i consensi sono modificabili e puoi stampare il documento o avviare la
                firma elettronica.
              </div>

              <div className="d-grid gap-2 mt-3">
                <button
                  className="btn btn-gdpr-outline"
                  type="submit"
                  name="gdpr_action"
                  value="print"
                  formTarget="_blank"
                >
                  <i className="bi bi-printer me-1" />
                  Stampa Privacy
                </button>
                <button
                  className="btn btn-gdpr-outline"
                  type="submit"
                  name="gdpr_action"
                  value="send_signature"
                  data-client-consents-confirm="Inviare la richiesta di firma elettronica al cliente?"
                >
                  <i className="bi bi-pen me-1" />
                  Invia Firma Elettronica
                </button>
                <button className="btn btn-gdpr-outline" type="button" disabled>
                  <i className="bi bi-send me-1" />
                  Invia Privacy
                </button>
              </div>

              <div className="gdpr-upload-box mt-3">
                <div className="fw-semibold small mb-2">Carica il PDF firmato manualmente</div>
                <input
                  className="form-control mb-2"
                  type="file"
                  name="gdpr_signed_pdf"
                  accept="application/pdf"
                />
                <button
                  className="btn btn-outline-secondary w-100"
                  type="submit"
                  name="gdpr_action"
                  value="manual_upload"
                >
                  <i className="bi bi-upload me-1" />
                  Carica PDF firmato
                </button>
              </div>
            </form>
          </div>

          <div className="card p-3 p-lg-4 consent-quick-card">
            <div className="fw-semibold mb-2">
              <i className="bi bi-lightbulb me-1" />
              Flusso suggerito
            </div>
            <ol className="consent-summary-list">
              <li>Verifica il modulo associato al cliente e controlla che il contenuto sia corretto.</li>
              <li>
                Scegli se stampare il PDF e caricarlo firmato manualmente oppure inviare la firma
                elettronica.
              </li>
              <li>
                Quando il documento e firmato, apri o invia il PDF ufficiale e, se serve, usa Reset
                per ricominciare la procedura.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
