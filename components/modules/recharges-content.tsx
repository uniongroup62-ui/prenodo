"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP recharges page (app/pages/recharges.php +
// assets/js/pages/recharges.js), fed by the existing /api/manage/fidelity
// (whose source covers fidelity + wallet + recharges). The "Modelli di
// ricarica" table is driven by recharge templates; the current API does not
// expose them, so it renders the original empty state ("Nessun modello.").

type RechargeTemplate = {
  id: number;
  title: string;
  baseAmount?: number;
  base_amount?: number;
  bonusKind?: string;
  bonus_kind?: string;
  bonusValue?: number;
  bonus_value?: number;
  earnPoints?: number | boolean;
  earn_points?: number | boolean;
  isActive?: number | boolean;
  is_active?: number | boolean;
  sortOrder?: number;
  sort_order?: number;
};

type FidelityResponse = {
  ok?: boolean;
  fidelityEnabled?: boolean;
  templates?: RechargeTemplate[];
  rechargeTemplates?: RechargeTemplate[];
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtEuro(n: number): string {
  return `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bonusAmount(t: RechargeTemplate): number {
  const base = num(t.baseAmount ?? t.base_amount);
  const kind = String(t.bonusKind ?? t.bonus_kind ?? "none");
  const value = num(t.bonusValue ?? t.bonus_value);
  if (kind === "percent") return (base * value) / 100;
  if (kind === "fixed") return value;
  return 0;
}

function bonusLabel(t: RechargeTemplate): string {
  const kind = String(t.bonusKind ?? t.bonus_kind ?? "none");
  const value = num(t.bonusValue ?? t.bonus_value);
  if (kind === "percent") return `${value}%`;
  if (kind === "fixed") return fmtEuro(value);
  return "—";
}

function earnsPoints(t: RechargeTemplate): boolean {
  const v = t.earnPoints ?? t.earn_points;
  return v === true || Number(v) === 1;
}

export function RechargesContent() {
  const slug = tenantSlug();
  const [templates, setTemplates] = useState<RechargeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: FidelityResponse) => {
        if (cancelled) return;
        const list = j.rechargeTemplates ?? j.templates ?? [];
        setTemplates(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=recharges${suffix}`;
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/recharges.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Programma punti</div>
          <h1 className="bs-page-title">Ricariche</h1>
          <div className="bs-page-subtitle">Gestisci credito prepagato, bonus e campagne punti.</div>
        </div>
        <div className="bs-page-actions">
          <div className="text-muted small">Nessuna campagna punti attiva oggi</div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Modelli di ricarica</div>
              <button
                className="btn btn-sm btn-primary"
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#templateModal"
                data-mode="create"
              >
                <i className="bi bi-plus" /> Nuovo modello
              </button>
            </div>
            <div className="text-muted small mb-2">
              I modelli ti aiutano a creare ricariche standard (es. 100€ + 20€ bonus) e vengono usati dalla pagina{" "}
              <strong>Pagamenti</strong> per aggiungere rapidamente una ricarica al carrello.
            </div>

            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th className="text-end">Ricarica</th>
                    <th className="text-end">Bonus</th>
                    <th className="text-end">Totale</th>
                    <th className="text-end">Calcolo punti</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted p-2">
                        {loading ? "Caricamento…" : "Nessun modello."}
                      </td>
                    </tr>
                  ) : (
                    templates.map((t) => {
                      const base = num(t.baseAmount ?? t.base_amount);
                      const bonus = bonusAmount(t);
                      return (
                        <tr key={t.id}>
                          <td className="fw-semibold">{t.title}</td>
                          <td className="text-end">{fmtEuro(base)}</td>
                          <td className="text-end">{bonusLabel(t)}</td>
                          <td className="text-end">{fmtEuro(base + bonus)}</td>
                          <td className="text-end">
                            {earnsPoints(t) ? "Importo + bonus" : "Solo ricarica"}
                          </td>
                          <td className="text-end">
                            <a className="btn btn-sm btn-outline-secondary" href={href(`&action=edit&id=${t.id}`)}>
                              Modifica
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="recharges-info-box h-100">
            <div className="recharges-info-box__icon" aria-hidden="true">
              <i className="bi bi-info-circle" />
            </div>
            <div className="recharges-info-box__body">
              <div className="recharges-info-box__title">Come funziona il modello di ricarica</div>
              <div className="recharges-info-box__text">
                Il modello serve per velocizzare le ricariche credito dalla pagina <strong>Pagamenti</strong> mantenendo
                sempre la stessa struttura commerciale.
              </div>
              <ul className="recharges-info-box__list mb-0">
                <li>
                  <strong>Ricarica</strong>: è l&apos;importo pagato dal cliente alla cassa.
                </li>
                <li>
                  <strong>Bonus</strong>: è il credito extra aggiunto al wallet del cliente secondo la regola scelta nel
                  modello.
                </li>
                <li>
                  <strong>Totale</strong>: è il credito finale caricato sul cliente, dato da{" "}
                  <strong>ricarica + bonus</strong>.
                </li>
                <li>
                  Se il modello è attivo, sarà disponibile in <strong>Pagamenti</strong> per aggiungerlo rapidamente al
                  carrello.
                </li>
                <li>
                  Il calcolo dei <strong>Punti</strong> può avvenire su <strong>importo + bonus</strong> oppure sul{" "}
                  <strong>solo importo ricarica</strong>, in base all&apos;impostazione del modello.
                </li>
                <li>
                  Il cliente riceve il credito sul wallet al momento della vendita; eventuali storni vanno gestiti dai
                  movimenti credito.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Crea/Modifica modello */}
      <div className="modal fade" id="templateModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form method="post" id="templateForm">
              <input type="hidden" name="_mode" id="template_mode" value="create_template" />
              <input type="hidden" name="template_id" id="template_id_field" value="" />

              <div className="modal-header">
                <h5 className="modal-title" id="templateModalTitle">
                  Nuovo modello
                </h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Titolo</label>
                    <input className="form-control" name="title" id="t_title" placeholder="Es. Ricarica 100 + 20" required />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Importo ricarica</label>
                    <div className="input-group">
                      <span className="input-group-text">€</span>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="99999999.99"
                        name="base_amount"
                        id="t_base_amount"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Bonus</label>
                    <div className="input-group">
                      <select
                        className="form-select recharge-bonus-kind-select"
                        name="bonus_kind"
                        id="t_bonus_kind"
                        defaultValue="none"
                      >
                        <option value="none">Nessuno</option>
                        <option value="percent">% su importo</option>
                        <option value="fixed">€ fisso</option>
                      </select>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        min="0"
                        max="99999999.99"
                        name="bonus_value"
                        id="t_bonus_value"
                        defaultValue="0"
                        disabled
                      />
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Ordinamento</label>
                    <input
                      className="form-control"
                      type="number"
                      step="1"
                      name="sort_order"
                      id="t_sort_order"
                      defaultValue="0"
                    />
                    <div className="form-text">Più basso = più in alto.</div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        value="1"
                        name="earn_points"
                        id="t_earn_points"
                        defaultChecked
                        aria-describedby="t_earn_points_help"
                      />
                      <label className="form-check-label" htmlFor="t_earn_points">
                        Calcola i punti anche sul bonus (importo + bonus)
                      </label>
                    </div>
                    <div className="form-text" id="t_earn_points_help">
                      Se attivo, i Punti saranno calcolati su <strong>importo + bonus</strong>. Se disattivo, verranno
                      calcolati <strong>solo sull&apos;importo ricarica</strong>.
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        value="1"
                        name="is_active"
                        id="t_is_active"
                        defaultChecked
                      />
                      <label className="form-check-label" htmlFor="t_is_active">
                        Modello attivo
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Annulla
                </button>
                <button className="btn btn-primary" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
