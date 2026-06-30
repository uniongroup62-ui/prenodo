"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP coupon NEW / EDIT form (app/pages/coupons.php,
// action=new|edit). Field groups and Bootstrap markup mirror the legacy editor:
//   - Codice (code; editable + required on new, readonly on edit), Descrizione
//   - Tipo (discount_type: percent/fixed) + Valore (discount_value)
//   - Importo minimo totale (min_subtotal), Limite di utilizzo per cliente
//     (usage_limit; 0 = illimitato)
//   - Attiva per (apply_scope), Valido dal / Valido al (valid_from / valid_to)
// Submits to /api/manage/coupons (action=save; create when no id, update with
// id — the code is immutable on edit, faithful to the readonly legacy input).
//
// TODO: the legacy editor also renders the scope-restricted catalogs
// (service_category_ids[]/service_ids[]/product_category_ids[]/product_ids[]
// multi-selects) and the per-location "Sedi abilitate" toggles. Those catalogs
// and the coupon_locations sync are not part of the current coupon data
// pipeline (listDbCoupons / coupons table), so they are not yet ported here.

type CouponForm = {
  id: number;
  code: string;
  description: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_subtotal: string;
  usage_limit: string;
  apply_scope: string;
  valid_from: string;
  valid_to: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function emptyForm(): CouponForm {
  return {
    id: 0,
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: "10",
    min_subtotal: "0",
    usage_limit: "0",
    apply_scope: "all_services_products",
    valid_from: "",
    valid_to: "",
  };
}

// Resolve the legacy-style ?action=new|edit once, synchronously from the URL.
function resolveAction(): "new" | "edit" {
  if (typeof window === "undefined") return "new";
  return new URLSearchParams(window.location.search).get("action") === "edit" ? "edit" : "new";
}

export function CouponFormContent() {
  const slug = tenantSlug();
  const [action] = useState<"new" | "edit">(resolveAction);
  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // On edit (action=edit&id=) prefill from coupons?action=get. On new, keep the
  // faithful defaults (percent / 10 / scope all_services_products).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const act = params.get("action") === "edit" ? "edit" : "new";
    const id = Number.parseInt(params.get("id") ?? "", 10);

    const editPromise =
      act === "edit" && Number.isFinite(id) && id > 0
        ? fetch(`/api/manage/coupons?slug=${encodeURIComponent(slug)}&action=get&id=${id}`, {
            headers: { "x-tenant-slug": slug },
          })
            .then((r) => r.json())
            .then((j) => {
              if (!j.ok || !j.coupon) {
                setError(String(j.error ?? "Coupon non trovato."));
                return;
              }
              const c = j.coupon;
              setForm({
                id: Number(c.id ?? id),
                code: String(c.code ?? ""),
                description: String(c.description ?? ""),
                discount_type: c.type === "fixed" ? "fixed" : "percent",
                discount_value: String(c.value ?? 0),
                min_subtotal: String(c.minSubtotal ?? 0),
                usage_limit: String(c.usageLimit ?? 0),
                apply_scope: String(c.applyScope ?? "all"),
                valid_from: String(c.startsAt ?? "").slice(0, 10),
                valid_to: String(c.endsAt ?? "").slice(0, 10),
              });
            })
            .catch(() => setError("Errore nel caricamento del coupon."))
        : Promise.resolve();

    editPromise.finally(() => setLoading(false));
  }, [slug]);

  function set<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function backToList() {
    window.location.href = `/${encodeURIComponent(slug)}/coupons`;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    // Validation faithful to coupons.php POST: on new the code is required and
    // must match [A-Z0-9][A-Z0-9_-]{0,39}; value must be > 0; date order checked.
    if (action === "new") {
      const code = form.code.trim().toUpperCase();
      if (code === "") {
        setError("Inserisci un codice.");
        return;
      }
      if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) {
        setError("Codice non valido. Usa solo lettere, numeri, - e _. (Max 40)");
        return;
      }
    }
    const value = Number.parseFloat(form.discount_value.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Inserisci un valore valido.");
      return;
    }
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to) {
      setError('La data "Valido al" deve essere successiva o uguale a "Valido dal".');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: "save",
        id: String(form.id),
        code: form.code,
        description: form.description,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_subtotal: form.min_subtotal,
        usage_limit: form.usage_limit,
        apply_scope: form.apply_scope,
        valid_from: form.valid_from,
        valid_to: form.valid_to,
      };
      const res = await fetch(`/api/manage/coupons?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(String(j.error ?? "Errore nel salvataggio del coupon."));
        setSaving(false);
        return;
      }
      backToList();
    } catch {
      setError("Errore nel salvataggio del coupon.");
      setSaving(false);
    }
  }

  const title = action === "new" ? "Nuovo coupon" : "Modifica coupon";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/coupons.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Buoni</div>
          <h1 className="bs-page-title">{title}</h1>
          <div className="bs-page-subtitle">Crea e gestisci codici sconto e campagne coupon.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/coupons`}>
            <i className="bi bi-arrow-left me-1" />
            Torna ai coupon
          </a>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="card p-3 text-muted small">Caricamento…</div>
      ) : (
        <div className="card p-3 mb-3">
          <form method="post" onSubmit={onSubmit}>
            <input type="hidden" name="id" value={form.id} />
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Codice</label>
                {action === "new" ? (
                  <>
                    <input
                      className="form-control"
                      name="code"
                      required
                      value={form.code}
                      onChange={(e) => set("code", e.target.value)}
                    />
                    <div className="form-text">Max 40 caratteri. Solo lettere, numeri, - e _.</div>
                  </>
                ) : (
                  <>
                    <input className="form-control" name="code" readOnly value={form.code} />
                    <div className="form-text">Il codice non è modificabile dopo la creazione.</div>
                  </>
                )}
              </div>

              <div className="col-md-5">
                <label className="form-label">Descrizione</label>
                <input
                  className="form-control"
                  name="description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  name="discount_type"
                  value={form.discount_type}
                  onChange={(e) => set("discount_type", e.target.value as CouponForm["discount_type"])}
                >
                  <option value="percent">%</option>
                  <option value="fixed">€</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Valore</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  name="discount_value"
                  value={form.discount_value}
                  onChange={(e) => set("discount_value", e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Importo minimo totale</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  name="min_subtotal"
                  value={form.min_subtotal}
                  onChange={(e) => set("min_subtotal", e.target.value)}
                />
                <div className="form-text">
                  Il coupon si attiva solo se il totale servizi/prodotti raggiunge questo importo.
                </div>
              </div>

              <div className="col-md-2">
                <label className="form-label">Limite di utilizzo per cliente</label>
                <input
                  className="form-control"
                  type="number"
                  step="1"
                  min="0"
                  name="usage_limit"
                  value={form.usage_limit}
                  onChange={(e) => set("usage_limit", e.target.value)}
                />
                <div className="form-text">0 = illimitato per cliente.</div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Attiva per</label>
                <select
                  className="form-select"
                  name="apply_scope"
                  value={form.apply_scope}
                  onChange={(e) => set("apply_scope", e.target.value)}
                >
                  {form.apply_scope === "all" ? <option value="all">Tutto il carrello (legacy)</option> : null}
                  <option value="service_categories">Categorie di servizi</option>
                  <option value="services">Servizi</option>
                  <option value="product_categories">Categorie di prodotti</option>
                  <option value="products">Prodotti</option>
                  <option value="all_services_products">Tutti i servizi e tutti i prodotti</option>
                </select>
                <div className="form-text">Gli altri elementi del carrello saranno esclusi dallo sconto coupon.</div>
              </div>

              <div className="col-md-2">
                <label className="form-label">Valido dal</label>
                <input
                  className="form-control"
                  type="date"
                  name="valid_from"
                  value={form.valid_from}
                  onChange={(e) => set("valid_from", e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Valido al</label>
                <input
                  className="form-control"
                  type="date"
                  name="valid_to"
                  value={form.valid_to}
                  onChange={(e) => set("valid_to", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 d-flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <i className="bi bi-check2-circle me-1" />
                {saving ? "Salvataggio…" : "Salva"}
              </button>
              <button className="btn btn-outline-secondary" type="button" onClick={backToList}>
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
