"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP gift CAMPAIGN editor (app/pages/gifts.php,
// action=new|edit — "Nuova/Modifica campagna"). This is the campaign TEMPLATE
// editor (the `gifts` row + a single unlock rule + enabled sedi + reward items),
// distinct from the issued gift INSTANCES list (gifts-content.tsx). Bootstrap
// markup mirrors the legacy form:
//   - Nome, "Solo clienti con Fidelity" (fidelity_only), Descrizione, Attivo
//   - Sedi abilitate: per-location checkboxes (gift_location_ids[])
//   - "Cosa viene regalato": repeatable reward items (type service/product/custom,
//     service/product select, custom label/details, qty)
//   - Valido dal / Valido al (required) + Scadenza dopo sblocco (giorni)
//   - Regola di sblocco: ONE rule (service_qty/product_qty/appointments_count/
//     total_spend/first_visit + target service/product + threshold)
//   - Condizioni gift: terms_enabled switch + terms_text textarea
// Submits to /api/manage/gifts (action=save; create when no id, update with id).
//
// TODO: the legacy editor also renders the advanced Fidelity targeting — the
// "Livelli Punti" checkboxes (eligible_levels_points[], required when
// fidelity_only) and the "Escludi clienti" picker (excluded_client_ids[]). Those
// depend on the Fidelity card-levels config and the per-client eligibility
// snapshots (Gifts::clientEligibilitySnapshots), which are not part of the
// current gift save pipeline, so they are not yet ported here. The clone mode
// (action=clone) and the impacted-instances reconciliation are also not ported.

type CatalogItem = { id: number; name: string };

type RewardItem = {
  type: "service" | "product" | "custom";
  service_id: number;
  product_id: number;
  custom_label: string;
  custom_details: string;
  qty: number;
};

type GiftForm = {
  id: number;
  name: string;
  description: string;
  fidelity_only: boolean;
  active: boolean;
  terms_enabled: boolean;
  terms_text: string;
  valid_from: string;
  valid_to: string;
  expires_after_days: string;
  location_ids: number[];
  reward_items: RewardItem[];
  rule_type: string;
  rule_service_id: number;
  rule_product_id: number;
  rule_threshold: string;
};

const DEFAULT_TERMS = [
  "Voucher utilizzabile una sola volta.",
  "Non convertibile in denaro e non rimborsabile.",
  "Presentare il barcode o il codice voucher in cassa.",
].join("\n");

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function emptyRewardItem(): RewardItem {
  return { type: "service", service_id: 0, product_id: 0, custom_label: "", custom_details: "", qty: 1 };
}

function emptyForm(): GiftForm {
  return {
    id: 0,
    name: "",
    description: "",
    fidelity_only: false,
    active: true,
    terms_enabled: false,
    terms_text: DEFAULT_TERMS,
    valid_from: "",
    valid_to: "",
    expires_after_days: "",
    location_ids: [],
    reward_items: [emptyRewardItem()],
    rule_type: "appointments_count",
    rule_service_id: 0,
    rule_product_id: 0,
    rule_threshold: "1",
  };
}

function resolveAction(): "new" | "edit" {
  if (typeof window === "undefined") return "new";
  return new URLSearchParams(window.location.search).get("action") === "edit" ? "edit" : "new";
}

export function GiftFormContent() {
  const slug = tenantSlug();
  const [action] = useState<"new" | "edit">(resolveAction);
  const [form, setForm] = useState<GiftForm>(emptyForm());
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [locations, setLocations] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const act = params.get("action") === "edit" ? "edit" : "new";
    const id = Number.parseInt(params.get("id") ?? "", 10);

    const ctxPromise = fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}&action=context`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        setServices(Array.isArray(j.services) ? j.services : []);
        setProducts(Array.isArray(j.products) ? j.products : []);
        setLocations(Array.isArray(j.locations) ? j.locations : []);
        return j;
      })
      .catch(() => ({}));

    if (act === "edit" && Number.isFinite(id) && id > 0) {
      Promise.all([
        ctxPromise,
        fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}&action=get&id=${id}`, {
          headers: { "x-tenant-slug": slug },
        }).then((r) => r.json()),
      ])
        .then(([, j]) => {
          if (!j.ok || !j.gift) {
            setError(String(j.error ?? "Campagna non trovata."));
            return;
          }
          const g = j.gift;
          setForm({
            id: Number(g.id ?? id),
            name: String(g.name ?? ""),
            description: String(g.description ?? ""),
            fidelity_only: Boolean(g.fidelityOnly),
            active: Boolean(g.active),
            terms_enabled: Boolean(g.termsEnabled),
            terms_text: String(g.termsText ?? "") || DEFAULT_TERMS,
            valid_from: String(g.validFrom ?? "").slice(0, 10),
            valid_to: String(g.validTo ?? "").slice(0, 10),
            expires_after_days: String(g.expiresAfterDays ?? ""),
            location_ids: (g.locationIds ?? []).map(Number).filter((n: number) => n > 0),
            reward_items: ((g.rewardItems ?? []) as Array<Record<string, unknown>>).map((it) => ({
              type: it.type === "product" || it.type === "custom" ? (it.type as RewardItem["type"]) : "service",
              service_id: Number(it.serviceId ?? 0) || 0,
              product_id: Number(it.productId ?? 0) || 0,
              custom_label: String(it.customLabel ?? ""),
              custom_details: String(it.customDetails ?? ""),
              qty: Math.max(1, Number(it.qty ?? 1) || 1),
            })),
            rule_type: String(g.rule?.ruleType ?? "appointments_count"),
            rule_service_id: Number(g.rule?.targetServiceId ?? 0) || 0,
            rule_product_id: Number(g.rule?.targetProductId ?? 0) || 0,
            rule_threshold: String(g.rule?.threshold ?? "1"),
          });
        })
        .catch(() => setError("Errore nel caricamento della campagna."))
        .finally(() => setLoading(false));
    } else {
      ctxPromise.finally(() => setLoading(false));
    }
  }, [slug]);

  function set<K extends keyof GiftForm>(key: K, value: GiftForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLocation(id: number, checked: boolean) {
    setForm((prev) => {
      const current = new Set(prev.location_ids);
      if (checked) current.add(id);
      else current.delete(id);
      return { ...prev, location_ids: Array.from(current) };
    });
  }

  function setReward(index: number, patch: Partial<RewardItem>) {
    setForm((prev) => {
      const next = prev.reward_items.slice();
      next[index] = { ...next[index], ...patch };
      return { ...prev, reward_items: next };
    });
  }

  function addReward() {
    setForm((prev) => ({ ...prev, reward_items: [...prev.reward_items, emptyRewardItem()] }));
  }

  function removeReward(index: number) {
    setForm((prev) => {
      if (prev.reward_items.length <= 1) return prev;
      return { ...prev, reward_items: prev.reward_items.filter((_, i) => i !== index) };
    });
  }

  function backToList() {
    window.location.href = `/${encodeURIComponent(slug)}/index.php?page=gifts&action=campaigns`;
  }

  const minValidFrom = useMemo(() => (action === "new" ? new Date().toISOString().slice(0, 10) : ""), [action]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    if (name === "") {
      setError("Nome campagna obbligatorio.");
      return;
    }
    if (!form.valid_from) {
      setError('Inserisci una data "Valido dal".');
      return;
    }
    if (!form.valid_to) {
      setError('Inserisci una data "Valido al".');
      return;
    }
    if (form.valid_from > form.valid_to) {
      setError('La data "Valido al" deve essere successiva a "Valido dal".');
      return;
    }
    const validReward = form.reward_items.some((it) =>
      it.type === "custom" ? it.custom_label.trim() !== "" : it.type === "service" ? it.service_id > 0 : it.product_id > 0,
    );
    if (!validReward) {
      setError("Aggiungi almeno un elemento da regalare.");
      return;
    }

    setSaving(true);
    try {
      const rewardItemsJson = form.reward_items.map((it) => ({
        type: it.type,
        service_id: it.service_id,
        product_id: it.product_id,
        custom_label: it.custom_label,
        custom_details: it.custom_details,
        qty: it.qty,
      }));
      const payload: Record<string, unknown> = {
        action: "save",
        id: String(form.id),
        name,
        description: form.description,
        fidelity_only: form.fidelity_only ? "1" : "0",
        active: form.active ? "1" : "0",
        terms_enabled: form.terms_enabled ? "1" : "0",
        terms_text: form.terms_text,
        valid_from: form.valid_from,
        valid_to: form.valid_to,
        expires_after_days: form.expires_after_days,
        location_ids: form.location_ids.join(","),
        reward_items_json: JSON.stringify(rewardItemsJson),
        rule_type: form.rule_type,
        rule_service_id: String(form.rule_service_id),
        rule_product_id: String(form.rule_product_id),
        rule_threshold: form.rule_threshold,
      };
      const res = await fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(String(j.error ?? "Errore nel salvataggio della campagna."));
        setSaving(false);
        return;
      }
      backToList();
    } catch {
      setError("Errore nel salvataggio della campagna.");
      setSaving(false);
    }
  }

  const title = action === "new" ? "Nuova campagna" : "Modifica campagna";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/gifts.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelity</div>
          <h1 className="bs-page-title">{title}</h1>
          <div className="bs-page-subtitle">Gestisci campagne, premi, sedi e stati.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=gifts&action=campaigns`}>
            <i className="bi bi-arrow-left me-1" />
            Campagne gift
          </a>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="card p-3 text-muted small">Caricamento…</div>
      ) : (
        <div className="card p-3 mb-3">
          <form method="post" id="giftForm" onSubmit={onSubmit}>
            <input type="hidden" name="id" value={form.id} />

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Nome</label>
                <input className="form-control" name="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="col-md-6">
                <div className="form-check mt-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="fidelity_only"
                    id="giftFidelityOnly"
                    checked={form.fidelity_only}
                    onChange={(e) => set("fidelity_only", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="giftFidelityOnly">Solo clienti con Fidelity</label>
                </div>
                <div className="form-text">Se disabilitato, tutti i clienti possono usufruire dell&apos;omaggio.</div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Descrizione (opzionale)</label>
                <input className="form-control" name="description" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="col-md-3">
                <label className="form-label">Attivo</label>
                <select className="form-select" name="active" value={form.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
                  <option value="1">Sì</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">Sedi abilitate</label>
                <div className="table-responsive border rounded">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Sede</th>
                        <th className="text-center gifts-location-valid-col">Valida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-muted">Nessuna sede disponibile.</td>
                        </tr>
                      ) : (
                        locations.map((loc) => (
                          <tr key={loc.id}>
                            <td className="fw-semibold">{loc.name || `Sede #${loc.id}`}</td>
                            <td className="text-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                name="gift_location_ids[]"
                                value={loc.id}
                                checked={form.location_ids.includes(loc.id)}
                                onChange={(e) => toggleLocation(loc.id, e.target.checked)}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-12">
                <label className="form-label">Cosa viene regalato</label>
                <div className="form-text mb-2">Puoi aggiungere più elementi della stessa campagna: servizi, prodotti e custom.</div>
                <div id="rewardItemsWrap" className="d-flex flex-column gap-2">
                  {form.reward_items.map((ri, index) => (
                    <div className="border rounded-3 p-2 reward-item-row" key={index}>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-2">
                          <label className="form-label small text-muted">Tipo</label>
                          <select
                            className="form-select reward-item-type"
                            value={ri.type}
                            onChange={(e) => setReward(index, { type: e.target.value as RewardItem["type"] })}
                          >
                            <option value="service">Servizio</option>
                            <option value="product">Prodotto</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {ri.type === "service" ? (
                          <div className="col-md-6 reward-item-service-wrap">
                            <label className="form-label small text-muted">Servizio</label>
                            <select
                              className="form-select reward-item-service"
                              value={ri.service_id || ""}
                              onChange={(e) => setReward(index, { service_id: Number(e.target.value) || 0 })}
                            >
                              <option value="">— seleziona —</option>
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {ri.type === "product" ? (
                          <div className="col-md-6 reward-item-product-wrap">
                            <label className="form-label small text-muted">Prodotto</label>
                            <select
                              className="form-select reward-item-product"
                              value={ri.product_id || ""}
                              onChange={(e) => setReward(index, { product_id: Number(e.target.value) || 0 })}
                            >
                              <option value="">— seleziona —</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {ri.type === "custom" ? (
                          <div className="col-md-6 reward-item-custom-label-wrap">
                            <label className="form-label small text-muted">Etichetta custom</label>
                            <input
                              className="form-control reward-item-custom-label"
                              value={ri.custom_label}
                              placeholder="Es. Piega gratuita"
                              onChange={(e) => setReward(index, { custom_label: e.target.value })}
                            />
                          </div>
                        ) : null}
                        <div className="col-md-2">
                          <label className="form-label small text-muted">Quantità</label>
                          <input
                            className="form-control reward-item-qty"
                            type="number"
                            min="1"
                            step="1"
                            value={ri.qty}
                            onChange={(e) => setReward(index, { qty: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
                          />
                        </div>
                        <div className="col-md-2 d-flex justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-danger reward-item-remove mt-md-4"
                            type="button"
                            disabled={form.reward_items.length <= 1}
                            onClick={() => removeReward(index)}
                          >
                            ✕
                          </button>
                        </div>
                        {ri.type === "custom" ? (
                          <div className="col-12 reward-item-custom-details-wrap">
                            <label className="form-label small text-muted">Dettagli (opzionale)</label>
                            <input
                              className="form-control reward-item-custom-details"
                              value={ri.custom_details}
                              placeholder="Es. Valido dal lunedì al giovedì"
                              onChange={(e) => setReward(index, { custom_details: e.target.value })}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <button className="btn btn-sm btn-outline-primary" type="button" onClick={addReward}>
                    Aggiungi elemento
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label">Valido dal</label>
                <input
                  className="form-control"
                  type="date"
                  name="valid_from"
                  required
                  min={minValidFrom || undefined}
                  value={form.valid_from}
                  onChange={(e) => set("valid_from", e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Valido al</label>
                <input
                  className="form-control"
                  type="date"
                  name="valid_to"
                  required
                  value={form.valid_to}
                  onChange={(e) => set("valid_to", e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Scadenza dopo sblocco (giorni)</label>
                <input
                  className="form-control"
                  type="number"
                  name="expires_after_days"
                  placeholder="—"
                  value={form.expires_after_days}
                  onChange={(e) => set("expires_after_days", e.target.value)}
                />
              </div>
            </div>

            <hr className="my-4" />

            <h2 className="h6 fw-semibold mb-2">Regola di sblocco</h2>
            <div className="text-muted small mb-2">Ogni campagna può avere una sola regola di sblocco.</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle" id="rulesTable">
                <thead>
                  <tr>
                    <th className="gifts-rule-type-col">Tipo</th>
                    <th>Cosa deve acquistare il cliente</th>
                    <th className="gifts-rule-threshold-col">Soglia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <select className="form-select form-select-sm rule-type" value={form.rule_type} onChange={(e) => set("rule_type", e.target.value)}>
                        <option value="service_qty">Quantità servizio</option>
                        <option value="product_qty">Quantità prodotto</option>
                        <option value="appointments_count">Numero appuntamenti</option>
                        <option value="total_spend">Spesa totale (€)</option>
                        <option value="first_visit">Prima visita</option>
                      </select>
                    </td>
                    <td>
                      {form.rule_type === "service_qty" ? (
                        <select
                          className="form-select form-select-sm rule-service"
                          value={form.rule_service_id || ""}
                          onChange={(e) => set("rule_service_id", Number(e.target.value) || 0)}
                        >
                          <option value="">— seleziona servizio —</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : form.rule_type === "product_qty" ? (
                        <select
                          className="form-select form-select-sm rule-product"
                          value={form.rule_product_id || ""}
                          onChange={(e) => set("rule_product_id", Number(e.target.value) || 0)}
                        >
                          <option value="">— seleziona prodotto —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted small">Nessun elemento specifico richiesto.</span>
                      )}
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm rule-threshold"
                        value={form.rule_threshold}
                        placeholder="1"
                        onChange={(e) => set("rule_threshold", e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="form-text mt-2">È consentita una sola regola di sblocco per campagna.</div>

            <hr className="my-4" />

            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                name="terms_enabled"
                id="gift_terms_enabled"
                checked={form.terms_enabled}
                onChange={(e) => set("terms_enabled", e.target.checked)}
              />
              <label className="form-check-label fw-semibold" htmlFor="gift_terms_enabled">Condizioni gift</label>
            </div>
            <div id="gift_terms_box" className={`mt-2 ${form.terms_enabled ? "" : "d-none"}`}>
              <textarea
                className="form-control gifts-terms-text"
                name="terms_text"
                rows={5}
                placeholder="Scrivi una condizione per riga..."
                value={form.terms_text}
                onChange={(e) => set("terms_text", e.target.value)}
              />
              <div className="form-text">
                Se abilitate, verranno mostrate nel Voucher omaggio e nella mail inviata al cliente. Se lasci vuoto verrà usato il
                testo predefinito.
              </div>
            </div>

            <div className="mt-4 d-flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <i className="bi bi-check2-circle me-1" />
                {saving ? "Salvataggio…" : action === "edit" ? "Salva modifiche" : "Salva"}
              </button>
              <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=gifts`}>
                Annulla
              </a>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
