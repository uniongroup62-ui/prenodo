"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP client sheets editor (app/pages/client_sheets.php).
// This is the per-client technical-sheets workspace: KPI tiles, the "available
// tabs" list, the "compilations" history list, and the record/builder editor
// panes. The legacy page is keyed by a `client_id` GET parameter and is reached
// from the clients page; it is not a settings/config module, so it has no
// `/api/manage/configuration?module=client_sheets` data shape to pre-fill from
// (that endpoint is generic and, for this module, returns no settings records).
// We reproduce the original Bootstrap markup verbatim, load the original page
// CSS, and surface the empty states + builder exactly as the PHP renders them.

const PRESETS = {
  blank: [],
  dimagrimento: [
    { label: "Peso", type: "number", unit: "kg", required: 1, placeholder: "Es. 72.4", help: "Rilevazione peso della seduta" },
    { label: "Circonferenza vita", type: "number", unit: "cm", placeholder: "Es. 84", help: "Misura all’altezza ombelico" },
    { label: "Circonferenza fianchi", type: "number", unit: "cm", placeholder: "Es. 101" },
    { label: "Coscia destra", type: "number", unit: "cm" },
    { label: "Coscia sinistra", type: "number", unit: "cm" },
    { label: "Ritenzione / cellulite", type: "select", options: ["Assente", "Lieve", "Moderata", "Marcata"], placeholder: "", help: "Valutazione visiva del tessuto" },
    { label: "Foto prima", type: "photo_before", help: "Carica immagini iniziali del percorso" },
    { label: "Foto dopo", type: "photo_after", help: "Carica immagini di confronto" },
  ],
  viso: [
    { label: "Tipo pelle", type: "select", options: ["Secca", "Mista", "Grassa", "Sensibile", "Acneica"], required: 1 },
    { label: "Obiettivo trattamento", type: "text", required: 1, placeholder: "Es. illuminante, anti-age, purificante" },
    { label: "Zone critiche", type: "textarea", help: "Macchie, rossori, impurità, rughe" },
    { label: "Prodotti consigliati", type: "textarea" },
    { label: "Foto prima", type: "photo_before" },
    { label: "Foto dopo", type: "photo_after" },
  ],
  laser: [
    { label: "Zona trattata", type: "text", required: 1 },
    { label: "Fototipo", type: "select", options: ["I", "II", "III", "IV", "V", "VI"], required: 1 },
    { label: "Energia impostata", type: "number", unit: "J" },
    { label: "Note operatore", type: "textarea" },
    { label: "Foto prima", type: "photo_before" },
    { label: "Foto dopo", type: "photo_after" },
  ],
} as const;

const TYPE_UI = {
  text: { unit: false, placeholder: true, options: false },
  textarea: { unit: false, placeholder: true, options: false },
  number: { unit: true, placeholder: true, options: false },
  date: { unit: false, placeholder: false, options: false },
  select: { unit: false, placeholder: false, options: true },
  checkbox: { unit: false, placeholder: false, options: false },
  photo_before: { unit: false, placeholder: false, options: false },
  photo_after: { unit: false, placeholder: false, options: false },
  photo: { unit: false, placeholder: false, options: false },
  document: { unit: false, placeholder: false, options: false },
} as const;

const CLIENT_SHEETS_CONFIG = {
  presets: PRESETS,
  typeUi: TYPE_UI,
  defaultMaxBytes: 5242880,
  defaultMaxFiles: 5,
};

type ClientInfo = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function clientIdFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("client_id") || params.get("id") || 0) || 0;
}

const TYPE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["text", "Testo breve"],
  ["textarea", "Testo lungo"],
  ["number", "Numero / misura"],
  ["date", "Data"],
  ["select", "Scelta da elenco"],
  ["checkbox", "Sì / No"],
  ["photo_before", "Foto prima"],
  ["photo_after", "Foto dopo"],
  ["photo", "Foto generica"],
  ["document", "Documento"],
];

export function ClientSheetsContent() {
  const slug = tenantSlug();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const clientId = clientIdFromUrl();

  useEffect(() => {
    if (!slug || !clientId) return;
    fetch(`/api/manage/clients?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const list: Array<Record<string, unknown>> = Array.isArray(j.clients) ? j.clients : [];
        const found = list.find((c) => Number(c.id) === clientId);
        if (found) {
          setClient({
            id: Number(found.id),
            name: String(found.name ?? ""),
            phone: found.phone ? String(found.phone) : "",
            email: found.email ? String(found.email) : "",
          });
        }
      })
      .catch(() => {});
  }, [slug, clientId]);

  function href(page: string, extra: string = ""): string {
    return `/${encodeURIComponent(slug)}/${`${page}${extra}`.replace("&", "?")}`;
  }

  const templateConfigUrl = href("client_sheet_templates", `&return_client_id=${clientId}`);
  const backUrl = href("clients", `&action=view&id=${clientId}`);

  const displayName = client?.name ? client.name : clientId ? `Cliente #${clientId}` : "—";
  const phone = client?.phone ? client.phone : "-";
  const email = client?.email ? client.email : "-";
  const subtitle = `${phone} - ${email}`;

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/client_sheets.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Compilazioni cliente</div>
          <h1 className="bs-page-title">{displayName}</h1>
          <div className="bs-page-subtitle">{subtitle}</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            <a className="btn btn-outline-primary" href={templateConfigUrl}>
              <i className="bi bi-sliders me-1" />
              Configura schede
            </a>
            <a className="btn btn-outline-secondary" href={backUrl}>
              <i className="bi bi-arrow-left me-1" />
              Scheda cliente
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-1">
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Tab tecnici</div>
            <div className="value">0</div>
            <div className="text-muted small mt-2">ogni tab ha i propri campi personalizzati</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Schede compilate</div>
            <div className="value">0</div>
            <div className="text-muted small mt-2">storico sempre disponibile per questo cliente</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Ultima compilazione</div>
            <div className="value sheet-tile-value-compact">—</div>
            <div className="text-muted small mt-2">ultimo aggiornamento registrato</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-xl-3">
          <div className="sheet-surface p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-layout-sidebar-inset me-2" />
                  Schede disponibili
                </div>
                <div className="text-muted small">Seleziona il tab da compilare per questo cliente.</div>
              </div>
              <a className="btn btn-sm btn-outline-primary" href={templateConfigUrl} title="Configura schede">
                <i className="bi bi-sliders" />
              </a>
            </div>

            <div className="sheet-empty-state">
              <div className="mb-2 sheet-empty-icon">
                <i className="bi bi-journal-text" />
              </div>
              <div className="fw-semibold">Nessuna scheda configurata</div>
              <div className="text-muted small mt-2">Configura almeno un tab tecnico prima di compilare lo storico cliente.</div>
              <a className="btn btn-primary btn-sm mt-3" href={`${templateConfigUrl}&new_template=1`}>
                Configura schede
              </a>
            </div>
          </div>
        </div>

        <div className="col-xl-3">
          <div className="sheet-surface p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-collection me-2" />
                  Compilazioni
                </div>
                <div className="text-muted small">Storico delle schede salvate del cliente.</div>
              </div>
            </div>

            <div className="sheet-empty-state">
              <div className="mb-2 sheet-empty-icon">
                <i className="bi bi-file-earmark-text" />
              </div>
              <div className="fw-semibold">Nessuna scheda compilata</div>
              <div className="text-muted small mt-2">Salva una scheda da un tab disponibile per iniziare a costruire lo storico del cliente.</div>
            </div>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="sheet-surface p-0 overflow-hidden">
            <div className="sheet-form-header">
              <i className="bi bi-clipboard2-pulse" />
              <span>Compila scheda</span>
            </div>

            <div className="tab-content">
              <div className="tab-pane fade show active" id="sheetRecordPane" role="tabpanel">
                <div className="p-3 p-lg-4">
                  <div className="sheet-empty-state">
                    <div className="fw-semibold">Nessuna scheda disponibile</div>
                    <div className="text-muted small mt-2">Configura i tab tecnici e poi torna qui per compilare lo storico del cliente.</div>
                    <a className="btn btn-primary btn-sm mt-3" href={`${templateConfigUrl}&new_template=1`}>
                      <i className="bi bi-sliders me-1" />
                      Configura schede
                    </a>
                  </div>
                </div>
              </div>

              <div className="tab-pane fade" id="sheetBuilderPane" role="tabpanel">
                <div className="p-3 p-lg-4">
                  <form method="post" id="sheetTemplateForm" className="vstack gap-3" noValidate>
                    <input type="hidden" name="_action" value="save_template" />
                    <input type="hidden" name="template_id" value="0" />
                    <input type="hidden" name="location_id" value="" />
                    <div className="alert alert-danger d-none mb-0 sheet-builder-alert" id="sheetTemplateValidationAlert" />

                    <div className="card border-0 bg-light-subtle">
                      <div className="card-body">
                        <div className="row g-3 align-items-end">
                          <div className="col-md-5">
                            <label className="form-label fw-semibold">Nome tab</label>
                            <input type="text" className="form-control" name="title" defaultValue="" placeholder="Es. Dimagrimento, Viso, Laser, Percorso corpo" />
                          </div>
                          <div className="col-md-5">
                            <label className="form-label fw-semibold">Descrizione</label>
                            <input type="text" className="form-control" name="description" defaultValue="" placeholder="Es. Misure, progressi e foto prima/dopo" />
                          </div>
                          <div className="col-md-2">
                            <div className="form-check form-switch mt-4">
                              <input className="form-check-input" type="checkbox" role="switch" id="template_active" name="is_active" value="1" defaultChecked />
                              <label className="form-check-label" htmlFor="template_active">
                                Tab attivo
                              </label>
                            </div>
                          </div>
                          <div className="col-12">
                            <label className="form-label fw-semibold">Sedi abilitate</label>
                            <input type="hidden" name="location_ids[]" value="" />
                            <div className="row g-2" />
                            <div className="form-text">
                              Il tab comparirà nei clienti aperti da queste sedi. Le compilazioni già salvate restano nella sede in cui sono state create.
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="sheet-builder-toolbar">
                              <div className="text-muted small">Scegli un preset per partire veloce oppure costruisci la scheda da zero.</div>
                              <div className="d-flex gap-2 flex-wrap">
                                <select className="form-select form-select-sm sheet-preset-select" id="sheetPresetSelect" defaultValue="blank">
                                  <option value="blank">Preset vuoto</option>
                                  <option value="dimagrimento">Preset dimagrimento</option>
                                  <option value="viso">Preset viso</option>
                                  <option value="laser">Preset laser</option>
                                </select>
                                <button className="btn btn-sm btn-outline-primary" type="button" id="applySheetPreset">
                                  <i className="bi bi-magic me-1" />
                                  Carica preset
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <div>
                          <span className="fw-semibold">
                            <i className="bi bi-ui-checks-grid me-2" />
                            Campi personalizzati
                          </span>
                          <div className="text-muted small mt-1">
                            Aggiungi misure, menu, note, campi foto e documenti. Ogni tab può avere una struttura diversa.
                          </div>
                        </div>
                        <button className="btn btn-outline-primary btn-sm" type="button" id="addSheetFieldRow">
                          <i className="bi bi-plus-circle me-1" />
                          Aggiungi campo
                        </button>
                      </div>
                      <div className="card-body">
                        <div id="sheetFieldBuilder" data-allow-empty="0">
                          <div className="sheet-field-row border rounded-4 p-3 mb-3 bg-light-subtle" data-field-row>
                            <div className="row g-3 align-items-start">
                              <div className="col-md-4">
                                <label className="form-label">
                                  Etichetta campo <span className="text-danger">*</span>
                                </label>
                                <input type="hidden" name="fields[row_0][id]" value="" />
                                <input
                                  type="text"
                                  className="form-control"
                                  name="fields[row_0][label]"
                                  defaultValue=""
                                  placeholder="Es. Peso, Circonferenza vita, Foto prima"
                                  data-field-label-input
                                  required
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Tipo</label>
                                <select className="form-select" name="fields[row_0][type]" data-field-type defaultValue="text">
                                  {TYPE_OPTIONS.map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-2 d-none" data-field-unit-wrap>
                                <label className="form-label">
                                  Unità <span className="text-danger">*</span>
                                </label>
                                <input type="text" className="form-control" name="fields[row_0][unit]" defaultValue="" placeholder="kg, cm, ml" data-field-unit-input />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label">Obbligatorio</label>
                                <div className="form-check form-switch mt-2">
                                  <input className="form-check-input" type="checkbox" role="switch" name="fields[row_0][required]" value="1" />
                                  <label className="form-check-label">Sì</label>
                                </div>
                              </div>
                              <div className="col-md-1 d-flex justify-content-end align-items-start pt-md-4">
                                <button type="button" className="btn btn-outline-danger btn-sm" data-remove-field-row>
                                  <i className="bi bi-trash" />
                                </button>
                              </div>

                              <div className="col-md-6" data-field-placeholder-wrap>
                                <label className="form-label">Placeholder / esempio</label>
                                <input type="text" className="form-control" name="fields[row_0][placeholder]" defaultValue="" placeholder="Es. 72.5 oppure Pelle sensibile" />
                              </div>
                              <div className="col-md-6" data-field-help-wrap>
                                <label className="form-label">Aiuto operatore</label>
                                <input type="text" className="form-control" name="fields[row_0][help]" defaultValue="" placeholder="Suggerimento visualizzato sotto il campo" />
                              </div>
                              <div className="col-12 d-none" data-field-options-wrap>
                                <label className="form-label">
                                  Opzioni elenco <span className="text-danger">*</span>
                                </label>
                                <input type="text" className="form-control" name="fields[row_0][options_raw]" defaultValue="" placeholder="Opzione 1, Opzione 2, Opzione 3" data-field-options-input />
                                <div className="form-text">Usa una virgola per separare le scelte del menu a tendina.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                      <div className="text-muted small">
                        Ogni compilazione eredita questi campi. I campi foto accettano fino a 5 immagini, mentre il campo documento accetta fino a 5 file.
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-primary" type="submit">
                          <i className="bi bi-check2-circle me-1" />
                          Salva tab
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Builder row template cloned by the page JS when "Aggiungi campo" is clicked. */}
      <template id="sheetFieldRowTemplate">
        <div className="sheet-field-row border rounded-4 p-3 mb-3 bg-light-subtle" data-field-row>
          <div className="row g-3 align-items-start">
            <div className="col-md-4">
              <label className="form-label">
                Etichetta campo <span className="text-danger">*</span>
              </label>
              <input type="hidden" data-name="id" defaultValue="" />
              <input type="text" className="form-control" data-name="label" placeholder="Es. Peso, Circonferenza vita, Foto prima" data-field-label-input required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Tipo</label>
              <select className="form-select" data-name="type" data-field-type>
                {TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 d-none" data-field-unit-wrap>
              <label className="form-label">
                Unità <span className="text-danger">*</span>
              </label>
              <input type="text" className="form-control" data-name="unit" placeholder="kg, cm, ml" data-field-unit-input />
            </div>
            <div className="col-md-2">
              <label className="form-label">Obbligatorio</label>
              <div className="form-check form-switch mt-2">
                <input className="form-check-input" type="checkbox" role="switch" data-name="required" value="1" />
                <label className="form-check-label">Sì</label>
              </div>
            </div>
            <div className="col-md-1 d-flex justify-content-end align-items-start pt-md-4">
              <button type="button" className="btn btn-outline-danger btn-sm" data-remove-field-row>
                <i className="bi bi-trash" />
              </button>
            </div>
            <div className="col-md-6" data-field-placeholder-wrap>
              <label className="form-label">Placeholder / esempio</label>
              <input type="text" className="form-control" data-name="placeholder" placeholder="Es. 72.5 oppure Pelle sensibile" />
            </div>
            <div className="col-md-6" data-field-help-wrap>
              <label className="form-label">Aiuto operatore</label>
              <input type="text" className="form-control" data-name="help" placeholder="Suggerimento visualizzato sotto il campo" />
            </div>
            <div className="col-12 d-none" data-field-options-wrap>
              <label className="form-label">
                Opzioni elenco <span className="text-danger">*</span>
              </label>
              <input type="text" className="form-control" data-name="options_raw" placeholder="Opzione 1, Opzione 2, Opzione 3" data-field-options-input />
              <div className="form-text">Usa una virgola per separare le scelte del menu a tendina.</div>
            </div>
          </div>
        </div>
      </template>

      <div className="sheet-gallery-overlay d-none" id="sheetGalleryOverlay" aria-hidden="true">
        <div className="sheet-gallery-dialog">
          <button className="sheet-gallery-nav" type="button" data-gallery-prev aria-label="Immagine precedente">
            <i className="bi bi-chevron-left" />
          </button>
          <div className="sheet-gallery-stage">
            <button className="sheet-gallery-close" type="button" data-gallery-close aria-label="Chiudi gallery">
              <i className="bi bi-x-lg" />
            </button>
            <img src="" alt="" data-gallery-image-view />
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mt-3">
              <div className="sheet-gallery-caption text-break">
                <div className="fw-semibold" data-gallery-caption-title />
                <div className="sheet-gallery-caption-note d-none" data-gallery-caption-note />
              </div>
              <div className="sheet-gallery-counter" data-gallery-counter />
            </div>
          </div>
          <button className="sheet-gallery-nav" type="button" data-gallery-next aria-label="Immagine successiva">
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>

      <script
        type="application/json"
        id="clientSheetsConfig"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(CLIENT_SHEETS_CONFIG) }}
      />
    </div>
  );
}
