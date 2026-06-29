"use client";

import { useCallback, useEffect, useState } from "react";

// Faithful port of the PHP quote settings page (app/pages/quote_settings.php):
// company / document header fiscal data, default quote conditions (terms + footer)
// and quote payment methods. The live data is fed by the existing DB-backed
// /api/manage/configuration?module=quote_settings route, which exposes the
// `businesses` row as aggregated config records. Only a subset of the raw column
// values is recoverable from that aggregation, so the remaining fiscal/address
// inputs cannot be pre-filled from the API (see risks).

type ConfigRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt: string;
};

type ConfigResponse = {
  ok: boolean;
  records?: ConfigRecord[];
  module?: { records?: ConfigRecord[] };
};

type PaymentMethodRow = {
  name: string;
  details: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function recordByTitle(records: ConfigRecord[], title: string): ConfigRecord | undefined {
  return records.find((r) => r.title === title);
}

export function QuoteSettingsContent() {
  const slug = tenantSlug();

  // Anagrafica / intestazione documenti (pre-filled where the API exposes the value).
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [sdi, setSdi] = useState("");
  const [pec, setPec] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [cap, setCap] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Condizioni preventivo.
  const [terms, setTerms] = useState("");
  const [footer, setFooter] = useState("");

  // Metodi di pagamento (sempre almeno una riga, come nel PHP).
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([{ name: "", details: "" }]);

  const load = useCallback(() => {
    fetch(`/api/manage/configuration?module=quote_settings&slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ConfigResponse) => {
        const records = j.records ?? j.module?.records ?? [];
        if (!Array.isArray(records)) return;

        // Record "Intestazione": detail = quote_company_name || name, value = quote_email || email.
        const header = recordByTitle(records, "Intestazione");
        if (header) {
          setCompanyName(header.detail ?? "");
          setEmail(header.value ?? "");
        }
        // Record "Dati fiscali": detail = vat / tax_code / sdi joined " / ", value = quote_city.
        const fiscal = recordByTitle(records, "Dati fiscali");
        if (fiscal) {
          setCity(fiscal.value ?? "");
        }
        // Record "Footer preventivo": detail = quote_footer, value = quote_terms.
        const footerRec = recordByTitle(records, "Footer preventivo");
        if (footerRec) {
          setFooter(footerRec.detail ?? "");
          setTerms(footerRec.value ?? "");
        }
        // Record "Metodi pagamento": value/detail = payment_methods raw (string),
        // structure not recoverable here -> leave the editable row empty.
      })
      .catch(() => {
        /* leave defaults */
      });
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=${suffix}`;
  }

  function updatePm(idx: number, patch: Partial<PaymentMethodRow>): void {
    setPaymentMethods((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addPm(): void {
    setPaymentMethods((rows) => [...rows, { name: "", details: "" }]);
  }

  function removePm(idx: number): void {
    setPaymentMethods((rows) => {
      const next = rows.filter((_, i) => i !== idx);
      return next.length > 0 ? next : [{ name: "", details: "" }];
    });
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/quote_settings.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Vendite</div>
          <h1 className="bs-page-title">Preventivi / Impostazioni</h1>
          <div className="bs-page-subtitle">
            Configura intestazione documenti, condizioni standard e metodi di pagamento dei preventivi.
          </div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-outline-secondary btn-pill" href={href("quotes")}>
              <i className="bi bi-arrow-left me-1" />
              Preventivi
            </a>
            <a className="btn btn-primary btn-pill" href={href("quotes&action=new")}>
              <i className="bi bi-plus-lg me-1" />
              Nuovo preventivo
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <div className="card p-4">
            <form
              method="post"
              className="row g-3 align-items-end"
              onSubmit={(e) => e.preventDefault()}
            >
              <input type="hidden" name="action" value="save_quote_profile" />

              <div className="col-12">
                <div className="h5 fw-bold mb-1">Dati anagrafici e intestazione documenti</div>
                <div className="text-muted small">
                  Dati fiscali usati da preventivi, moduli consenso e intestazioni documento.
                </div>
              </div>
              <div className="col-lg-8">
                <label className="form-label" htmlFor="quoteCompanyName">
                  Ragione sociale / Intestazione
                </label>
                <input
                  className="form-control"
                  id="quoteCompanyName"
                  name="quote_company_name"
                  maxLength={255}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Es. BeautySuite S.r.l."
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteVatNumber">
                  P. IVA
                </label>
                <input
                  className="form-control"
                  id="quoteVatNumber"
                  name="quote_vat_number"
                  maxLength={40}
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="IT123..."
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteTaxCode">
                  Codice fiscale
                </label>
                <input
                  className="form-control"
                  id="quoteTaxCode"
                  name="quote_tax_code"
                  maxLength={40}
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteSdi">
                  SDI
                </label>
                <input
                  className="form-control"
                  id="quoteSdi"
                  name="quote_sdi"
                  maxLength={40}
                  value={sdi}
                  onChange={(e) => setSdi(e.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quotePec">
                  PEC
                </label>
                <input
                  className="form-control"
                  id="quotePec"
                  name="quote_pec"
                  type="email"
                  maxLength={190}
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label">Regione</label>
                <div className="dropdown app-combobox js-it-region-box">
                  <button
                    className="form-control text-start app-combobox-toggle dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                  >
                    <span className="app-combobox-text">{region}</span>
                    <span className="app-combobox-placeholder text-muted">Seleziona una regione...</span>
                  </button>
                  <input
                    type="hidden"
                    name="quote_region"
                    className="js-it-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                  <div className="dropdown-menu p-2 w-100 app-combobox-menu">
                    <input
                      type="text"
                      className="form-control form-control-sm app-combobox-search"
                      placeholder="Cerca..."
                      autoComplete="off"
                    />
                    <div className="list-group mt-2 app-combobox-list" />
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Provincia</label>
                <div className="dropdown app-combobox js-it-province-box">
                  <button
                    className="form-control text-start app-combobox-toggle dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    disabled
                  >
                    <span className="app-combobox-text">{province}</span>
                    <span className="app-combobox-placeholder text-muted">Seleziona prima la regione...</span>
                  </button>
                  <input
                    type="hidden"
                    name="quote_province"
                    className="js-it-province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                  <div className="dropdown-menu p-2 w-100 app-combobox-menu">
                    <input
                      type="text"
                      className="form-control form-control-sm app-combobox-search"
                      placeholder="Cerca..."
                      autoComplete="off"
                    />
                    <div className="list-group mt-2 app-combobox-list" />
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Citt&agrave;</label>
                <div className="dropdown app-combobox js-it-city-box">
                  <button
                    className="form-control text-start app-combobox-toggle dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    disabled
                  >
                    <span className="app-combobox-text">{city}</span>
                    <span className="app-combobox-placeholder text-muted">Seleziona prima la provincia...</span>
                  </button>
                  <input
                    type="hidden"
                    name="quote_city"
                    className="js-it-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <div className="dropdown-menu p-2 w-100 app-combobox-menu">
                    <input
                      type="text"
                      className="form-control form-control-sm app-combobox-search"
                      placeholder="Cerca..."
                      autoComplete="off"
                    />
                    <div className="list-group mt-2 app-combobox-list" />
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteCap">
                  CAP
                </label>
                <input
                  className="form-control"
                  id="quoteCap"
                  name="quote_cap"
                  maxLength={20}
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                />
              </div>
              <div className="col-lg-8">
                <label className="form-label" htmlFor="quoteAddress">
                  Indirizzo intestazione
                </label>
                <input
                  className="form-control"
                  id="quoteAddress"
                  name="quote_address"
                  maxLength={255}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Via ..."
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quotePhone">
                  Telefono documenti
                </label>
                <input
                  className="form-control"
                  id="quotePhone"
                  name="quote_phone"
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteEmail">
                  Email documenti
                </label>
                <input
                  className="form-control"
                  id="quoteEmail"
                  name="quote_email"
                  type="email"
                  maxLength={190}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="quoteWebsite">
                  Sito web
                </label>
                <input
                  className="form-control"
                  id="quoteWebsite"
                  name="quote_website"
                  inputMode="url"
                  maxLength={190}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="col-12 d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-pill" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva dati anagrafici
                </button>
                <a className="btn btn-outline-secondary btn-pill" href={href("quote_settings")}>
                  Annulla
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card p-4">
            <div className="h5 fw-bold mb-3">Condizioni preventivo</div>
            <div className="text-muted small mb-3">
              Questi testi vengono proposti automaticamente nei nuovi preventivi e restano modificabili nel singolo
              documento.
            </div>

            <form method="post" className="row g-3" onSubmit={(e) => e.preventDefault()}>
              <input type="hidden" name="action" value="save_quote_conditions" />

              <div className="col-12">
                <label className="form-label">Condizioni standard (opzionale)</label>
                <textarea
                  className="form-control"
                  name="quote_terms"
                  rows={4}
                  placeholder="Es. Validità 30 giorni..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
                <div className="form-text">
                  Verranno precompilate nei nuovi preventivi, ma resteranno modificabili nel singolo documento.
                </div>
              </div>

              <div className="col-12">
                <label className="form-label">Testo in calce (opzionale)</label>
                <textarea
                  className="form-control"
                  name="quote_footer"
                  rows={3}
                  placeholder="Es. Grazie per la fiducia..."
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                />
              </div>

              <div className="col-12 d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-pill" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva condizioni preventivo
                </button>
                <a className="btn btn-outline-secondary btn-pill" href={href("quote_settings")}>
                  Annulla
                </a>
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card p-4">
            <div className="h6 fw-bold mb-2">Nota</div>
            <div className="text-muted small">
              Le condizioni standard e il testo in calce vengono inseriti come default nei nuovi preventivi. Restano
              comunque modificabili prima dell&rsquo;invio al cliente.
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-8">
          <div className="card p-4">
            <div className="h5 fw-bold mb-3">Preventivi — Metodi di pagamento</div>
            <div className="text-muted small mb-3">
              Aggiungi i metodi di pagamento selezionabili nei preventivi. Ogni metodo ha un <strong>nome</strong> e,
              opzionalmente, dei <strong>dettagli</strong>.
            </div>

            <form method="post" className="row g-3" onSubmit={(e) => e.preventDefault()}>
              <input type="hidden" name="action" value="save_payment_methods" />

              <div className="col-12">
                <div className="border rounded-3 p-3 bg-light" id="pmRowsWrap">
                  {paymentMethods.map((pm, idx) => (
                    <div className="row g-2 align-items-start pm-row mb-2" data-idx={idx} key={idx}>
                      <div className="col-md-4">
                        <label className="form-label small mb-1">Nome</label>
                        <input
                          className="form-control"
                          name="pm_name[]"
                          value={pm.name}
                          onChange={(e) => updatePm(idx, { name: e.target.value })}
                          placeholder="Es. Bonifico"
                        />
                      </div>
                      <div className="col-md-7">
                        <label className="form-label small mb-1">Dettagli (opzionali)</label>
                        <textarea
                          className="form-control quote-settings-details"
                          name="pm_details[]"
                          rows={2}
                          value={pm.details}
                          onChange={(e) => updatePm(idx, { details: e.target.value })}
                          placeholder="Es. IBAN IT... / email / note..."
                        />
                      </div>
                      <div className="col-md-1 d-grid">
                        <button
                          className="btn btn-outline-danger btn-sm pm-remove"
                          type="button"
                          title="Rimuovi"
                          onClick={() => removePm(idx)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="d-flex gap-2 mt-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    id="pmAddBtn"
                    onClick={addPm}
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Aggiungi metodo
                  </button>
                </div>
                <div className="form-text">Nel preventivo potrai selezionare quali metodi mostrare al cliente.</div>
              </div>

              <div className="col-12 d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-pill" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva metodi
                </button>
                <a className="btn btn-outline-secondary btn-pill" href={href("quote_settings")}>
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
              Compila <strong>Nome</strong> e, se serve, <strong>Dettagli</strong> come IBAN, email PayPal o note
              operative.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
