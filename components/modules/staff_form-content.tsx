"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP operator NEW / EDIT form (app/pages/staff.php,
// the #staffOperatorCreateModal / action=edit form posted with action=staff_save).
// Field groups and Bootstrap markup mirror the legacy editor:
//   - Operatore: full_name (required), ui_role (Staff / Admin / Personalizzato)
//   - Account e contatti: email (required on new), password (required on new,
//     leave blank on edit to keep the current one), phone, calendar_color
//     (color picker, default #93c5fd), is_active (Attivo)
//   - Sedi abilitate: per-location checkboxes (location_ids[])
// Submits to /api/manage/resources (action=staff_save; create when no id, update
// with id) — the same endpoint/handler the legacy form posts to (saveStaffMember,
// which also upserts the login user + sends the "Conferma email account" invite).
//
// NOTE: the operator PHOTO upload (operator_photo / photo_crop_data, multipart)
// is NOT ported here — image management is a separate follow-up (saveStaffMember
// does not handle the photo). The "Admin" role option is shown for everyone here;
// the legacy hides it for non-admins as a cosmetic guard (role security is still
// enforced server-side by the staff.manage permission gate).

type LocationRow = { id: number; name: string; isActive?: boolean };

type StaffContext = {
  ok?: boolean;
  locations?: LocationRow[];
};

type StaffForm = {
  id: number;
  full_name: string;
  ui_role: "staff" | "admin" | "altro";
  email: string;
  password: string;
  phone: string;
  calendar_color: string;
  is_active: boolean;
  location_ids: number[];
};

const DEFAULT_COLOR = "#93c5fd";

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function emptyForm(): StaffForm {
  return {
    id: 0,
    full_name: "",
    ui_role: "staff",
    email: "",
    password: "",
    phone: "",
    calendar_color: DEFAULT_COLOR,
    is_active: true,
    location_ids: [],
  };
}

function normalizeColor(value: string): string {
  let cc = (value || "").trim();
  if (cc !== "" && cc[0] !== "#") cc = `#${cc}`;
  return /^#[0-9a-fA-F]{6}$/.test(cc) ? cc : DEFAULT_COLOR;
}

// Resolve the legacy-style ?action=new|edit once, synchronously from the URL.
function resolveAction(): "new" | "edit" {
  if (typeof window === "undefined") return "new";
  return new URLSearchParams(window.location.search).get("action") === "edit" ? "edit" : "new";
}

export function StaffFormContent() {
  const slug = tenantSlug();
  const [action] = useState<"new" | "edit">(resolveAction);
  const [form, setForm] = useState<StaffForm>(emptyForm());
  const [ctx, setCtx] = useState<StaffContext>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load the staff context (locations), then prefill on edit (action=get) or
  // keep the faithful new-operator defaults.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const act = params.get("action") === "edit" ? "edit" : "new";
    const id = Number.parseInt(params.get("id") ?? "", 10);

    const ctxPromise = fetch(`/api/manage/resources?slug=${encodeURIComponent(slug)}&section=staff`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: StaffContext) => {
        setCtx(j ?? {});
        return j ?? {};
      })
      .catch(() => {
        setCtx({});
        return {} as StaffContext;
      });

    if (act === "edit" && Number.isFinite(id) && id > 0) {
      Promise.all([
        ctxPromise,
        fetch(`/api/manage/resources?slug=${encodeURIComponent(slug)}&section=staff&action=get&id=${id}`, {
          headers: { "x-tenant-slug": slug },
        }).then((r) => r.json()),
      ])
        .then(([, j]) => {
          if (!j.ok || !j.staff) {
            setError(String(j.error ?? "Operatore non trovato."));
            return;
          }
          const s = j.staff;
          setForm({
            id: Number(s.id ?? id),
            full_name: String(s.fullName ?? ""),
            ui_role: (["staff", "admin", "altro"].includes(s.role) ? s.role : "staff") as StaffForm["ui_role"],
            email: String(s.email ?? ""),
            password: "",
            phone: String(s.phone ?? ""),
            calendar_color: normalizeColor(String(s.color ?? "")),
            is_active: Boolean(s.isActive ?? true),
            location_ids: (s.locationIds ?? []).map(Number).filter((n: number) => n > 0),
          });
        })
        .catch(() => setError("Errore nel caricamento dell'operatore."))
        .finally(() => setLoading(false));
    } else {
      ctxPromise.finally(() => setLoading(false));
    }
  }, [slug]);

  function set<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
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

  function backToList() {
    window.location.href = `/${encodeURIComponent(slug)}/staff`;
  }

  const locations = useMemo(() => ctx.locations ?? [], [ctx.locations]);
  const hasLocations = locations.length > 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    // Validation faithful to staff.php saveStaffMember: name required; email +
    // password required when creating the login account (id <= 0).
    const fullName = form.full_name.trim();
    if (fullName === "") {
      setError("Nome operatore obbligatorio.");
      return;
    }
    if (fullName.toUpperCase() === "SSO") {
      setError("Nome operatore riservato.");
      return;
    }
    if (action === "new" && (form.email.trim() === "" || form.password === "")) {
      setError("Email e password obbligatorie per creare l'account.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: "staff_save",
        id: String(form.id),
        full_name: fullName,
        ui_role: form.ui_role,
        email: form.email,
        password: form.password,
        phone: form.phone,
        calendar_color: form.calendar_color,
        is_active: form.is_active ? "1" : "0",
        location_ids: form.location_ids.join(","),
      };
      const res = await fetch(`/api/manage/resources?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(String(j.error ?? "Errore nel salvataggio dell'operatore."));
        setSaving(false);
        return;
      }
      backToList();
    } catch {
      setError("Errore nel salvataggio dell'operatore.");
      setSaving(false);
    }
  }

  const title = action === "new" ? "Nuovo operatore" : "Modifica operatore";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/staff.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Impostazioni</div>
          <h1 className="bs-page-title">{title}</h1>
          <div className="bs-page-subtitle">Gestisci operatori, ruoli e sedi abilitate.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/staff`}>
            <i className="bi bi-arrow-left me-1" />
            Torna allo staff
          </a>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="card p-3 text-muted small">Caricamento…</div>
      ) : (
        <div className="card p-3 mb-3">
          <form method="post" onSubmit={onSubmit}>
            <input type="hidden" name="action" value="staff_save" />
            <input type="hidden" name="id" value={form.id} />

            <div className="row g-3">
              <div className="col-12">
                <div className="fw-semibold mb-1">Operatore</div>
              </div>

              <div className="col-lg-6">
                <label className="form-label">Nome operatore</label>
                <input
                  className="form-control"
                  name="full_name"
                  required
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </div>

              <div className="col-lg-3">
                <label className="form-label">Ruolo</label>
                <select
                  className="form-select"
                  name="ui_role"
                  required={action === "new"}
                  value={form.ui_role}
                  onChange={(e) => set("ui_role", e.target.value as StaffForm["ui_role"])}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="altro">Personalizzato</option>
                </select>
              </div>

              <div className="col-12">
                <div className="fw-semibold mb-1 mt-2">Account e contatti</div>
              </div>

              <div className="col-lg-4">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  type="email"
                  name="email"
                  required={action === "new"}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>

              <div className="col-lg-4">
                <label className="form-label">Password (login)</label>
                <input
                  className="form-control"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required={action === "new"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
                {action === "edit" ? <div className="form-text">Lascia vuoto per non modificarla.</div> : null}
              </div>

              <div className="col-lg-4">
                <label className="form-label">Telefono</label>
                <input
                  className="form-control"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>

              <div className="col-lg-3">
                <label className="form-label">Colore calendario</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  name="calendar_color"
                  title="Scegli colore"
                  value={normalizeColor(form.calendar_color)}
                  onChange={(e) => set("calendar_color", e.target.value)}
                />
                <div className="form-text">Usato per la colonna nel calendario.</div>
              </div>

              <div className="col-lg-2">
                <label className="form-label">Stato</label>
                <div className="form-check form-switch pt-2">
                  <input
                    className="form-check-input"
                    id="staffIsActive"
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="staffIsActive">
                    Attivo
                  </label>
                </div>
              </div>

              <div className="col-12">
                <div className="fw-semibold mb-1 mt-2">Sedi abilitate</div>
                {hasLocations ? (
                  <>
                    <div className="staff-location-grid">
                      {locations.map((loc) => {
                        const lid = Number(loc.id);
                        if (lid <= 0) return null;
                        return (
                          <div className="form-check staff-location-card" key={lid}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              name="location_ids[]"
                              id={`staff_loc_${lid}`}
                              value={lid}
                              checked={form.location_ids.includes(lid)}
                              onChange={(e) => toggleLocation(lid, e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={`staff_loc_${lid}`}>
                              <span className="staff-location-card-title">{loc.name || `Sede #${lid}`}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="form-text">Seleziona almeno una sede in cui l&apos;operatore sara disponibile.</div>
                  </>
                ) : (
                  <div className="form-control-plaintext text-muted">Tutte le sedi</div>
                )}
              </div>
            </div>

            <hr className="my-3" />
            <div className="d-flex gap-2">
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
