"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP giftbox_settings page (app/pages/giftbox_settings.php):
// GiftBox default validity + GiftBox terms text. Current values are pre-filled
// from the existing DB-backed /api/manage/configuration?module=giftbox_settings
// route, which exposes them via the module records (record 1 "Validita
// predefinita" detail = "<value> <unit>", record 2 "Termini GiftBox"
// detail = raw terms text).

type ConfigRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt?: string;
};

type ConfigResponse = {
  ok?: boolean;
  records?: ConfigRecord[];
  module?: { records?: ConfigRecord[] };
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

// Default terms text, used when giftbox_terms is empty (matches PHP default).
const DEFAULT_TERMS = `Voucher utilizzabile in più appuntamenti fino ad esaurimento del contenuto.
Ad ogni utilizzo verranno scalati i singoli servizi/prodotti (riscatto parziale).
Non convertibile in denaro e non rimborsabile.
Presentare il codice (QR) o il codice alfanumerico in cassa per il riscatto.`;

export function GiftboxSettingsContent() {
  const slug = tenantSlug();

  const [validityValue, setValidityValue] = useState("0");
  const [validityUnit, setValidityUnit] = useState("days");
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  useEffect(() => {
    fetch(`/api/manage/configuration?module=giftbox_settings&slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ConfigResponse) => {
        const records = j.records ?? j.module?.records ?? [];
        const validity = records.find((rec) => rec.id === 1);
        const termsRec = records.find((rec) => rec.id === 2);

        if (validity && typeof validity.detail === "string") {
          // detail is "<value> <unit>" e.g. "0 days".
          const parts = validity.detail.trim().split(/\s+/);
          const rawValue = parts[0] ?? "0";
          const rawUnit = parts[1] ?? "days";
          if (/^\d+$/.test(rawValue)) setValidityValue(rawValue);
          if (rawUnit === "days" || rawUnit === "months" || rawUnit === "years") {
            setValidityUnit(rawUnit);
          }
        }

        if (termsRec && typeof termsRec.detail === "string" && termsRec.detail.trim() !== "") {
          setTerms(termsRec.detail);
        }
      })
      .catch(() => {});
  }, [slug]);

  const pageBase = `/${encodeURIComponent(slug)}/index.php?page=giftbox_settings`;

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/giftbox_settings.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Programma fedelta</div>
          <h1 className="bs-page-title">Fidelity / GiftBox / Impostazioni</h1>
          <div className="bs-page-subtitle">Configura scadenze e impostazioni predefinite GiftBox.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-outline-secondary btn-pill" href={`/${encodeURIComponent(slug)}/index.php?page=giftbox`}>
              <i className="bi bi-arrow-left me-1" />
              GiftBox
            </a>
            <a className="btn btn-primary btn-pill" href={`/${encodeURIComponent(slug)}/index.php?page=pos`}>
              <i className="bi bi-plus-lg me-1" />
              Crea GiftBox
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card p-4">
            <div className="h5 fw-bold mb-3">GiftBox — Scadenza predefinita</div>
            <div className="text-muted small mb-3">
              Quando emetti una <strong>GiftBox</strong> e lasci vuoto il campo <em>“Valida al”</em>, la scadenza viene
              calcolata automaticamente partendo da <em>“Validità dal”</em>. Imposta qui la durata predefinita:{" "}
              <strong>0</strong> significa nessuna scadenza automatica.
            </div>

            <form method="post" action={`${pageBase}&action=save_giftbox_validity_default`} className="border rounded-3 p-3 bg-light">
              <input type="hidden" name="action" value="save_giftbox_validity_default" />

              <div className="row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label">Durata</label>
                  <input
                    className="form-control"
                    type="number"
                    min={0}
                    max={36500}
                    name="giftbox_default_validity_value"
                    placeholder="0"
                    value={validityValue}
                    onChange={(e) => setValidityValue(e.target.value)}
                  />
                  <div className="form-text">0 = nessuna scadenza automatica</div>
                </div>
                <div className="col-md-5">
                  <label className="form-label">Unità</label>
                  <select
                    className="form-select"
                    name="giftbox_default_validity_unit"
                    value={validityUnit}
                    onChange={(e) => setValidityUnit(e.target.value)}
                  >
                    <option value="days">Giorni</option>
                    <option value="months">Mesi</option>
                    <option value="years">Anni</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 d-flex gap-2">
                <button className="btn btn-primary btn-pill" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva GiftBox
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card p-4">
            <div className="h6 fw-bold mb-2">Come funziona</div>
            <div className="text-muted small">
              <ul className="mb-0">
                <li>
                  <strong>Validità dal</strong> resta modificabile in fase di emissione.
                </li>
                <li>
                  Se <strong>Valida al</strong> è vuoto, viene calcolata usando questa durata.
                </li>
                <li>Le GiftBox già emesse non vengono modificate.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-8">
          <div className="card p-4">
            <div className="h5 fw-bold mb-3">GiftBox — Condizioni</div>
            <div className="text-muted small mb-3">
              Testo mostrato nel <strong>Voucher GiftBox</strong> e nella <strong>mail</strong> inviata al destinatario.
              Inserisci <strong>una riga per ogni condizione</strong>.
            </div>

            <form method="post" action={pageBase} className="row g-3">
              <div className="col-12">
                <label className="form-label">Testo condizioni</label>
                <textarea
                  className="form-control giftbox-settings-terms"
                  name="giftbox_terms"
                  rows={6}
                  placeholder="Scrivi una condizione per riga..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
                <div className="form-text">Se lasci vuoto verrà usato il testo predefinito.</div>
              </div>

              <div className="col-12 d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-pill" type="submit" name="action" value="save_giftbox_terms">
                  <i className="bi bi-check2-circle me-1" />
                  Salva condizioni
                </button>
                <button
                  className="btn btn-outline-danger btn-pill"
                  type="submit"
                  name="action"
                  value="reset_giftbox_terms"
                  data-giftbox-settings-confirm="Ripristinare il testo predefinito delle condizioni GiftBox?"
                >
                  <i className="bi bi-arrow-counterclockwise me-1" />
                  Ripristina testo predefinito
                </button>
                <a className="btn btn-outline-secondary btn-pill" href={pageBase}>
                  Annulla
                </a>
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card p-4">
            <div className="h6 fw-bold mb-2">Suggerimento</div>
            <div className="text-muted small">
              Personalizza qui le condizioni mostrate nel voucher e nella mail GiftBox. Per tornare al testo standard usa{" "}
              <strong>Ripristina testo predefinito</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
