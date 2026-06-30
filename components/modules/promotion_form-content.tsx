"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP promotion NEW / EDIT form (app/pages/promotions.php,
// action=new|edit). Card/section structure and Bootstrap markup mirror the
// legacy editor's core record:
//   - Informazioni: Nome (title, required), Descrizione, Testo condizioni
//     (promo_conditions_enabled + promo_conditions), Attiva (is_active)
//   - Servizi / Prodotti e sconto: apply_services_mode / apply_products_mode +
//     the "Tutti i servizi" / "Tutti i prodotti" global discount (discount_type
//     / discount_value, products_discount_type / products_discount_value)
//   - Validità: starts_at / ends_at
//   - Target clienti: target_type + new_within_days / inactive_days /
//     birthday_window_days
//   - Limiti utilizzo: per_customer_limit
// Submits to /api/manage/promotions (action=save; create when no id, update with
// id).
//
// TODO: the legacy editor additionally persists per-service/per-product discount
// rows (apply_*_mode=selected), promotion_locations ("Sedi abilitate"), time
// windows + blackout dates, fidelity-level targeting, client exclusions and the
// stackable bitmask via Promotions::saveAdvanced. Those sub-tables are not part
// of the current promotions data pipeline, so they are not yet ported here.

type ApplyMode = "none" | "all" | "selected";
type DiscountType = "percent" | "fixed";
type TargetType = "all" | "new" | "inactive" | "birthday" | "fidelity";

type PromotionForm = {
  id: number;
  title: string;
  description: string;
  promo_conditions_enabled: boolean;
  promo_conditions: string;
  is_active: boolean;
  apply_services_mode: ApplyMode;
  apply_products_mode: ApplyMode;
  discount_type: DiscountType;
  discount_value: string;
  min_qty: string;
  products_discount_type: DiscountType;
  products_discount_value: string;
  products_min_qty: string;
  starts_at: string;
  ends_at: string;
  target_type: TargetType;
  new_within_days: string;
  inactive_days: string;
  birthday_window_days: string;
  per_customer_limit: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function emptyForm(): PromotionForm {
  return {
    id: 0,
    title: "",
    description: "",
    promo_conditions_enabled: false,
    promo_conditions: "",
    is_active: true,
    apply_services_mode: "all",
    apply_products_mode: "none",
    discount_type: "percent",
    discount_value: "0",
    min_qty: "1",
    products_discount_type: "percent",
    products_discount_value: "0",
    products_min_qty: "1",
    starts_at: "",
    ends_at: "",
    target_type: "all",
    new_within_days: "",
    inactive_days: "",
    birthday_window_days: "",
    per_customer_limit: "",
  };
}

// Resolve the legacy-style ?action=new|edit once, synchronously from the URL.
function resolveAction(): "new" | "edit" {
  if (typeof window === "undefined") return "new";
  return new URLSearchParams(window.location.search).get("action") === "edit" ? "edit" : "new";
}

export function PromotionFormContent() {
  const slug = tenantSlug();
  const [action] = useState<"new" | "edit">(resolveAction);
  const [form, setForm] = useState<PromotionForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // On edit (action=edit&id=) prefill from promotions?action=get. On new, keep
  // the faithful defaults (all services / percent / active).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const act = params.get("action") === "edit" ? "edit" : "new";
    const id = Number.parseInt(params.get("id") ?? "", 10);

    const editPromise =
      act === "edit" && Number.isFinite(id) && id > 0
        ? fetch(`/api/manage/promotions?slug=${encodeURIComponent(slug)}&action=get&id=${id}`, {
            headers: { "x-tenant-slug": slug },
          })
            .then((r) => r.json())
            .then((j) => {
              if (!j.ok || !j.promotion) {
                setError(String(j.error ?? "Promozione non trovata."));
                return;
              }
              const p = j.promotion;
              setForm({
                id: Number(p.id ?? id),
                title: String(p.name ?? ""),
                description: String(p.description ?? ""),
                promo_conditions_enabled: Boolean(p.promoConditionsEnabled ?? false),
                promo_conditions: String(p.promoConditions ?? ""),
                is_active: Boolean(p.active ?? true),
                apply_services_mode: (p.applyServicesMode ?? "all") as ApplyMode,
                apply_products_mode: (p.applyProductsMode ?? "none") as ApplyMode,
                discount_type: p.discountType === "fixed" ? "fixed" : "percent",
                discount_value: String(p.discountValue ?? 0),
                min_qty: "1",
                products_discount_type: p.discountType === "fixed" ? "fixed" : "percent",
                products_discount_value: String(p.discountValue ?? 0),
                products_min_qty: "1",
                starts_at: String(p.startsAt ?? "").slice(0, 10),
                ends_at: String(p.endsAt ?? "").slice(0, 10),
                target_type: (p.target === "new_clients" ? "new" : p.target ?? "all") as TargetType,
                new_within_days: String(p.newWithinDays ?? ""),
                inactive_days: String(p.inactiveDays ?? ""),
                birthday_window_days: String(p.birthdayWindowDays ?? ""),
                per_customer_limit: String(p.perCustomerLimit ?? ""),
              });
            })
            .catch(() => setError("Errore nel caricamento della promozione."))
        : Promise.resolve();

    editPromise.finally(() => setLoading(false));
  }, [slug]);

  function set<K extends keyof PromotionForm>(key: K, value: PromotionForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function backToList() {
    window.location.href = `/${encodeURIComponent(slug)}/promotions`;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    // Validation faithful to promotions.php POST: title required, date format +
    // order, at least one of services/products included, positive "all" value.
    if (form.title.trim() === "") {
      setError("Inserisci il nome della promozione.");
      return;
    }
    if (form.starts_at !== "" && form.ends_at !== "" && form.starts_at > form.ends_at) {
      setError("La data di fine deve essere uguale o successiva alla data di inizio.");
      return;
    }
    if (form.apply_services_mode === "none" && form.apply_products_mode === "none") {
      setError("Seleziona almeno servizi o prodotti da includere nella promozione.");
      return;
    }
    if (form.apply_services_mode === "all") {
      const v = Number.parseFloat(form.discount_value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        setError("Inserisci uno sconto maggiore di 0 per tutti i servizi.");
        return;
      }
      if (form.discount_type === "percent" && v > 100) {
        setError("Lo sconto percentuale servizi non puo superare 100%.");
        return;
      }
    }
    if (form.promo_conditions_enabled && form.promo_conditions.trim() === "") {
      setError("Inserisci il testo delle condizioni promozionali oppure disattiva il flag.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: "save",
        id: String(form.id),
        title: form.title,
        description: form.description,
        promo_conditions_enabled: form.promo_conditions_enabled ? "1" : "0",
        promo_conditions: form.promo_conditions,
        is_active: form.is_active ? "1" : "0",
        apply_services_mode: form.apply_services_mode,
        apply_products_mode: form.apply_products_mode,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_qty: form.min_qty,
        products_discount_type: form.products_discount_type,
        products_discount_value: form.products_discount_value,
        products_min_qty: form.products_min_qty,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        target_type: form.target_type,
        new_within_days: form.new_within_days,
        inactive_days: form.inactive_days,
        birthday_window_days: form.birthday_window_days,
        per_customer_limit: form.per_customer_limit,
      };
      const res = await fetch(`/api/manage/promotions?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(String(j.error ?? "Errore nel salvataggio della promozione."));
        setSaving(false);
        return;
      }
      backToList();
    } catch {
      setError("Errore nel salvataggio della promozione.");
      setSaving(false);
    }
  }

  const title = action === "new" ? "Nuova promozione" : "Modifica promozione";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/promotions.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelizzazione</div>
          <h1 className="bs-page-title">{title}</h1>
          <div className="bs-page-subtitle">Gestisci promozioni, regole e visibilita per sedi e canali.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/promotions`}>
            <i className="bi bi-arrow-left me-1" />
            Torna alle promozioni
          </a>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="card p-3 text-muted small">Caricamento…</div>
      ) : (
        <form method="post" onSubmit={onSubmit}>
          <input type="hidden" name="id" value={form.id} />

          <div className="row g-3">
            <div className="col-lg-8">
              <div className="card mb-3">
                <div className="card-header fw-semibold">Informazioni</div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label">Nome promozione</label>
                      <input
                        className="form-control"
                        name="title"
                        required
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Descrizione (opz.)</label>
                      <textarea
                        className="form-control"
                        name="description"
                        rows={3}
                        value={form.description}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="promo_conditions_enabled"
                          id="promo_conditions_enabled"
                          checked={form.promo_conditions_enabled}
                          onChange={(e) => set("promo_conditions_enabled", e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="promo_conditions_enabled">
                          Testo condizioni nel booking (opz.)
                        </label>
                      </div>
                      {form.promo_conditions_enabled ? (
                        <div className="mt-2">
                          <textarea
                            className="form-control"
                            name="promo_conditions"
                            rows={3}
                            placeholder="Inserisci le condizioni della promozione (opz.)"
                            value={form.promo_conditions}
                            onChange={(e) => set("promo_conditions", e.target.value)}
                          />
                          <div className="form-text">
                            Questo testo viene mostrato nel booking sotto al totale; non aggiunge regole automatiche.
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="is_active"
                          id="is_active"
                          checked={form.is_active}
                          onChange={(e) => set("is_active", e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="is_active">
                          Attiva
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header fw-semibold">Servizi / Prodotti e sconto</div>
                <div className="card-body">
                  <div className="text-muted small mb-3">
                    Seleziona cosa includere nella promozione. Se scegli <strong>solo servizi/prodotti selezionati</strong>,
                    puoi impostare uno sconto per ogni elemento.
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Servizi inclusi</label>
                      <select
                        className="form-select"
                        name="apply_services_mode"
                        value={form.apply_services_mode}
                        onChange={(e) => set("apply_services_mode", e.target.value as ApplyMode)}
                      >
                        <option value="none">Nessuno</option>
                        <option value="all">Tutti i servizi</option>
                        <option value="selected">Solo servizi selezionati</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Prodotti inclusi</label>
                      <select
                        className="form-select"
                        name="apply_products_mode"
                        value={form.apply_products_mode}
                        onChange={(e) => set("apply_products_mode", e.target.value as ApplyMode)}
                      >
                        <option value="none">Nessuno</option>
                        <option value="all">Tutti i prodotti</option>
                        <option value="selected">Solo prodotti selezionati</option>
                      </select>
                    </div>
                  </div>

                  {form.apply_services_mode === "all" ? (
                    <div className="border rounded p-3 mb-3 mt-3">
                      <div className="fw-semibold mb-2">Sconto • Tutti i servizi</div>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">Tipo</label>
                          <select
                            className="form-select"
                            name="discount_type"
                            value={form.discount_type}
                            onChange={(e) => set("discount_type", e.target.value as DiscountType)}
                          >
                            <option value="percent">Percentuale (%)</option>
                            <option value="fixed">Importo fisso (€)</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Valore</label>
                          <input
                            className="form-control"
                            name="discount_value"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.discount_value}
                            onChange={(e) => set("discount_value", e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Quantità minima</label>
                          <input
                            className="form-control"
                            name="min_qty"
                            type="number"
                            min="1"
                            value={form.min_qty}
                            onChange={(e) => set("min_qty", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {form.apply_products_mode === "all" ? (
                    <div className="border rounded p-3 mt-3">
                      <div className="fw-semibold mb-2">Sconto • Tutti i prodotti</div>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">Tipo</label>
                          <select
                            className="form-select"
                            name="products_discount_type"
                            value={form.products_discount_type}
                            onChange={(e) => set("products_discount_type", e.target.value as DiscountType)}
                          >
                            <option value="percent">Percentuale (%)</option>
                            <option value="fixed">Importo fisso (€)</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Valore</label>
                          <input
                            className="form-control"
                            name="products_discount_value"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.products_discount_value}
                            onChange={(e) => set("products_discount_value", e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Quantità minima</label>
                          <input
                            className="form-control"
                            name="products_min_qty"
                            type="number"
                            min="1"
                            value={form.products_min_qty}
                            onChange={(e) => set("products_min_qty", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card mb-3">
                <div className="card-header fw-semibold">Validità</div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label">Dal</label>
                      <input
                        className="form-control"
                        name="starts_at"
                        type="date"
                        value={form.starts_at}
                        onChange={(e) => set("starts_at", e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label">Al</label>
                      <input
                        className="form-control"
                        name="ends_at"
                        type="date"
                        value={form.ends_at}
                        onChange={(e) => set("ends_at", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header fw-semibold">Target clienti</div>
                <div className="card-body">
                  <div className="mb-2">
                    <label className="form-label">Target</label>
                    <select
                      className="form-select"
                      name="target_type"
                      value={form.target_type}
                      onChange={(e) => set("target_type", e.target.value as TargetType)}
                    >
                      <option value="all">Tutti i clienti</option>
                      <option value="new">Nuovi clienti</option>
                      <option value="inactive">Clienti inattivi da X giorni</option>
                      <option value="birthday">Clienti con compleanno</option>
                      <option value="fidelity">Solo clienti con Fidelity</option>
                    </select>
                  </div>

                  {form.target_type === "new" ? (
                    <div className="border rounded p-2 mb-2">
                      <div className="fw-semibold small mb-1">Nuovi clienti</div>
                      <label className="form-label small">Entro quanti giorni dalla registrazione (opz.)</label>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        name="new_within_days"
                        placeholder="Es. 30"
                        value={form.new_within_days}
                        onChange={(e) => set("new_within_days", e.target.value)}
                      />
                      <div className="form-text">Se vuoto: consideriamo &ldquo;nuovo&rdquo; chi non ha appuntamenti precedenti.</div>
                    </div>
                  ) : null}

                  {form.target_type === "inactive" ? (
                    <div className="border rounded p-2 mb-2">
                      <div className="fw-semibold small mb-1">Inattivi</div>
                      <label className="form-label small">Inattivo da almeno X giorni</label>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="1"
                        name="inactive_days"
                        placeholder="Es. 60"
                        value={form.inactive_days}
                        onChange={(e) => set("inactive_days", e.target.value)}
                      />
                    </div>
                  ) : null}

                  {form.target_type === "birthday" ? (
                    <div className="border rounded p-2 mb-2">
                      <div className="fw-semibold small mb-1">Compleanno</div>
                      <label className="form-label small">Finestra (± giorni) intorno al compleanno</label>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        name="birthday_window_days"
                        placeholder="Es. 7"
                        value={form.birthday_window_days}
                        onChange={(e) => set("birthday_window_days", e.target.value)}
                      />
                      <div className="form-text">Se vuoto: valida solo il giorno del compleanno.</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card">
                <div className="card-header fw-semibold">Limiti utilizzo</div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label small">Utilizzi massimi per cliente (opz.)</label>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        name="per_customer_limit"
                        placeholder="Es. 1"
                        value={form.per_customer_limit}
                        onChange={(e) => set("per_customer_limit", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-text mt-2">Lascia vuoto per nessun limite.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <i className="bi bi-check2-circle me-1" />
              {saving ? "Salvataggio…" : "Salva"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={backToList}>
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
