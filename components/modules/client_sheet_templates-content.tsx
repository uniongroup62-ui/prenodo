"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP "Configura schede" page
// (app/pages/client_sheet_templates.php, ?page=client_sheet_templates).
// Reusable technical-tab templates per location/client. Fed by the existing
// DB-backed /api/manage/configuration?module=client_sheet_templates route
// (records) and /api/manage/locations (location checklist).

type TemplateRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt?: string | null;
};

type ConfigResponse = {
  ok?: boolean;
  module?: { records?: TemplateRecord[] };
  records?: TemplateRecord[];
};

type LocationRow = {
  id: number;
  name?: string;
};

type LocationsResponse = {
  locations?: LocationRow[];
  currentLocationId?: number;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function ClientSheetTemplatesContent() {
  const slug = tenantSlug();

  const [records, setRecords] = useState<TemplateRecord[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number>(0);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/manage/configuration?module=client_sheet_templates&slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ConfigResponse) => {
        const recs = j.module?.records ?? j.records ?? [];
        setRecords(Array.isArray(recs) ? recs : []);
      })
      .catch(() => setRecords([]));

    fetch(`/api/manage/locations?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: LocationsResponse) => {
        setLocations(Array.isArray(j.locations) ? j.locations : []);
        setCurrentLocationId(Number(j.currentLocationId ?? 0));
      })
      .catch(() => {
        setLocations([]);
        setCurrentLocationId(0);
      });
  }, [slug]);

  const href = useCallback(
    (suffix: string): string =>
      `/${encodeURIComponent(slug)}/index.php?page=client_sheet_templates${suffix}`,
    [slug],
  );

  const totalTabs = records.length;
  const activeTabs = useMemo(() => records.filter((r) => r.active).length, [records]);

  // Field-row select options (verbatim from PHP).
  const typeOptions: Array<[string, string]> = [
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

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/client_sheet_templates.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Clienti</div>
          <h1 className="bs-page-title">Configura schede</h1>
          <div className="bs-page-subtitle">Gestisci i tab tecnici riutilizzabili per sede e cliente.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap justify-content-end align-items-center">
            <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=clients`}>
              <i className="bi bi-arrow-left me-1" />
              Clienti
            </a>
            <a className="btn btn-primary" href={href("&new_template=1")}>
              <i className="bi bi-plus-lg me-1" />
              Nuovo tab
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Tab configurati</div>
            <div className="value">{totalTabs}</div>
            <div className="text-muted small mt-2">visibili nella sede corrente</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Tab attivi</div>
            <div className="value">{activeTabs}</div>
            <div className="text-muted small mt-2">disponibili per le compilazioni</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="sheet-tile">
            <div className="text-muted small">Compilazioni collegate</div>
            <div className="value">0</div>
            <div className="text-muted small mt-2">ultima: &mdash;</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-4">
          <div className="sheet-surface p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
              <div>
                <div className="fw-semibold">
                  <i className="bi bi-layout-sidebar-inset me-2" />
                  Tab schede
                </div>
                <div className="text-muted small">Template riutilizzabili per i clienti della sede.</div>
              </div>
              <a className="btn btn-sm btn-outline-primary" href={href("&new_template=1")}>
                <i className="bi bi-plus-lg" />
              </a>
            </div>

            {records.length === 0 ? (
              <div className="sheet-empty-state">
                <div className="mb-2 sheet-empty-icon">
                  <i className="bi bi-journal-text" />
                </div>
                <div className="fw-semibold">Nessun tab configurato</div>
                <div className="text-muted small mt-2">
                  Crea il primo tab tecnico per renderlo disponibile nelle compilazioni cliente.
                </div>
              </div>
            ) : (
              <div className="vstack gap-2">
                {records.map((rec) => (
                  <a
                    key={rec.id}
                    className="sheet-tab-item d-flex justify-content-between align-items-center gap-2"
                    href={href(`&edit_template=${rec.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="fw-semibold text-truncate">{rec.title}</div>
                      {rec.detail ? <div className="text-muted small text-truncate">{rec.detail}</div> : null}
                    </div>
                    {rec.active ? (
                      <span className="badge text-bg-success">Attivo</span>
                    ) : (
                      <span className="badge text-bg-secondary">Disattivo</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-xl-8">
          <div className="sheet-surface p-0 overflow-hidden">
            <div className="border-bottom bg-light-subtle px-3 py-2 text-center fw-semibold">
              <i className="bi bi-sliders me-1" />
              Nuovo tab
            </div>
            <div className="p-3 p-lg-4">
              <form method="post" id="sheetTemplateForm" className="vstack gap-3" noValidate>
                <input type="hidden" name="_csrf" value="" />
                <input type="hidden" name="_action" value="save_template" />
                <input type="hidden" name="template_id" value="0" />
                <input type="hidden" name="location_id" value={String(currentLocationId || "")} />
                <div className="alert alert-danger d-none mb-0 sheet-builder-alert" id="sheetTemplateValidationAlert" />

                <div className="card border-0 bg-light-subtle">
                  <div className="card-body">
                    <div className="row g-3 align-items-end">
                      <div className="col-md-5">
                        <label className="form-label fw-semibold">Nome tab</label>
                        <input
                          type="text"
                          className="form-control"
                          name="title"
                          defaultValue=""
                          placeholder="Es. Dimagrimento, Viso, Laser"
                        />
                      </div>
                      <div className="col-md-5">
                        <label className="form-label fw-semibold">Descrizione</label>
                        <input
                          type="text"
                          className="form-control"
                          name="description"
                          defaultValue=""
                          placeholder="Es. Misure e foto prima/dopo"
                        />
                      </div>
                      <div className="col-md-2">
                        <div className="form-check form-switch mt-4">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="template_active"
                            name="is_active"
                            value="1"
                            defaultChecked
                          />
                          <label className="form-check-label" htmlFor="template_active">
                            Tab attivo
                          </label>
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Sedi abilitate</label>
                        <input type="hidden" name="location_ids[]" value="" />
                        <div className="row g-2">
                          {locations.map((loc) => {
                            const checked = currentLocationId
                              ? loc.id === currentLocationId
                              : false;
                            return (
                              <div className="col-sm-6 col-lg-4" key={loc.id}>
                                <label
                                  className="border rounded-3 px-3 py-2 d-flex align-items-center gap-2 h-100 bg-white"
                                  htmlFor={`template_location_${loc.id}`}
                                >
                                  <input
                                    className="form-check-input m-0"
                                    type="checkbox"
                                    id={`template_location_${loc.id}`}
                                    name="location_ids[]"
                                    value={String(loc.id)}
                                    defaultChecked={checked}
                                  />
                                  <span className="small fw-semibold text-truncate">
                                    <i className="bi bi-geo-alt me-1 text-primary" />
                                    {loc.name ?? `Sede ${loc.id}`}
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        <div className="form-text">
                          Il tab comparira nelle compilazioni dei clienti aperti da queste sedi.
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="sheet-builder-toolbar">
                          <div className="text-muted small">
                            Scegli un preset per partire veloce oppure costruisci la scheda da zero.
                          </div>
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
                      <div className="text-muted small mt-1">Ogni compilazione eredita questi campi.</div>
                    </div>
                    <button className="btn btn-outline-primary btn-sm" type="button" id="addSheetFieldRow">
                      <i className="bi bi-plus-circle me-1" />
                      Aggiungi campo
                    </button>
                  </div>
                  <div className="card-body">
                    <div id="sheetFieldBuilder" data-allow-empty="0">
                      <div className="sheet-field-row border rounded-3 p-3 mb-3 bg-light-subtle" data-field-row="">
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
                              data-field-label-input=""
                              required
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Tipo</label>
                            <select className="form-select" name="fields[row_0][type]" data-field-type="" defaultValue="text">
                              {typeOptions.map(([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-2 d-none" data-field-unit-wrap="">
                            <label className="form-label">
                              Unita <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              name="fields[row_0][unit]"
                              defaultValue=""
                              placeholder="kg, cm, ml"
                              data-field-unit-input=""
                            />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label">Obbligatorio</label>
                            <div className="form-check form-switch mt-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                name="fields[row_0][required]"
                                value="1"
                              />
                              <label className="form-check-label">Si</label>
                            </div>
                          </div>
                          <div className="col-md-1 d-flex justify-content-end align-items-start pt-md-4">
                            <button type="button" className="btn btn-outline-danger btn-sm" data-remove-field-row="">
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                          <div className="col-md-6" data-field-placeholder-wrap="">
                            <label className="form-label">Placeholder / esempio</label>
                            <input
                              type="text"
                              className="form-control"
                              name="fields[row_0][placeholder]"
                              defaultValue=""
                              placeholder="Es. 72.5 oppure Pelle sensibile"
                            />
                          </div>
                          <div className="col-md-6" data-field-help-wrap="">
                            <label className="form-label">Aiuto operatore</label>
                            <input
                              type="text"
                              className="form-control"
                              name="fields[row_0][help]"
                              defaultValue=""
                              placeholder="Suggerimento visualizzato sotto il campo"
                            />
                          </div>
                          <div className="col-12 d-none" data-field-options-wrap="">
                            <label className="form-label">
                              Opzioni elenco <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              name="fields[row_0][options_raw]"
                              defaultValue=""
                              placeholder="Opzione 1, Opzione 2, Opzione 3"
                              data-field-options-input=""
                            />
                            <div className="form-text">Usa una virgola per separare le scelte del menu a tendina.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                  <div className="text-muted small">
                    I campi foto accettano fino a 5 immagini, mentre il campo documento accetta fino a 5 file.
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
  );
}
