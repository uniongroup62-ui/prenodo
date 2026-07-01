"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP fidelity/gifts page (app/pages/gifts.php): the Omaggi
// CAMPAIGN manager. Fed by /api/manage/gifts:
//   - GET  action=campaigns -> ManageGiftListRow[] (name, reward, validity, status, instances)
//   - POST action=toggle_active (id, active)   — activate/deactivate (content-gated)
//   - POST action=delete (id)                  — cascade delete
// The create/edit editor lives in gift_form-content (router: gifts action=new|edit).
// Deferred (documented): the accumulation/tracking engine, per-instance detail
// (gift_instance.php), manual assignment, terms/excluded-clients, clone.

type Campaign = {
  id: number;
  name: string;
  description: string;
  active: boolean;
  isCurrentlyActive: boolean;
  autoDisabled: boolean;
  fidelityOnly: boolean;
  validFrom: string;
  validTo: string;
  instancesCount: number;
  rewardSummary: string;
  locationIds: number[];
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function GiftsContent() {
  const slug = tenantSlug();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}&action=campaigns`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => setCampaigns(Array.isArray(j.campaigns) ? j.campaigns : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/${`gifts${suffix}`.replace("&", "?")}`;
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (term !== "" && !`${c.name} ${c.description} ${c.rewardSummary}`.toLowerCase().includes(term)) return false;
      if (statusFilter === "active" && !c.active) return false;
      if (statusFilter === "inactive" && c.active) return false;
      return true;
    });
  }, [campaigns, q, statusFilter]);

  async function post(fields: Record<string, string>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(fields),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !j.ok) throw new Error(String(j.error || "Operazione non riuscita."));
      if (Array.isArray(j.campaigns)) setCampaigns(j.campaigns as Campaign[]);
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Operazione non riuscita.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Campaign) {
    const j = await post({ action: "toggle_active", id: String(c.id), active: c.active ? "0" : "1" });
    if (j) setMsg(c.active ? "Campagna disattivata." : "Campagna attivata.");
  }

  async function remove(c: Campaign) {
    if (!window.confirm(`Eliminare la campagna omaggio "${c.name}"? Le istanze accumulate e i premi collegati verranno rimossi.`)) return;
    const j = await post({ action: "delete", id: String(c.id) });
    if (j) setMsg("Campagna eliminata.");
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/gifts.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelity</div>
          <h1 className="bs-page-title">Fidelity / Omaggi</h1>
          <div className="bs-page-subtitle">Omaggi avanzati con regole e tracking automatico.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-primary" href={href("&action=new")}>
              <i className="bi bi-plus-lg me-1" />
              Nuova campagna
            </a>
          </div>
        </div>
      </div>

      {msg ? <div className="alert alert-success">{msg}</div> : null}
      {err ? <div className="alert alert-danger">{err}</div> : null}

      {!loading && campaigns.length === 0 ? (
        <div className="card border-0 shadow-sm gifts-empty-card">
          <div className="gifts-empty-state">
            <div className="gifts-empty-icon" aria-hidden="true">
              <i className="bi bi-gift" />
            </div>
            <h2>Nessun omaggio configurato</h2>
            <p>Crea una campagna omaggio per iniziare ad assegnare premi ai clienti e seguirne accumulo, disponibilità e riscatto.</p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <a className="btn btn-primary" href={href("&action=new")}>
                <i className="bi bi-plus-lg me-1" />
                Nuova campagna
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-3 mb-3">
            <form className="row g-2 align-items-end" onSubmit={(e) => e.preventDefault()}>
              <div className="col-lg-6">
                <label className="form-label">Cerca</label>
                <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, premio o descrizione" />
              </div>
              <div className="col-lg-3">
                <label className="form-label">Stato</label>
                <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tutte</option>
                  <option value="active">Attive</option>
                  <option value="inactive">Disattivate</option>
                </select>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Campagna</th>
                    <th>Premio</th>
                    <th>Validità</th>
                    <th>Stato</th>
                    <th className="text-end">Istanze</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted p-3">
                        {loading ? "Caricamento…" : "Nessuna campagna trovata."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="fw-semibold">{c.name}</div>
                          {c.description ? <div className="text-muted small">{c.description}</div> : null}
                          {c.fidelityOnly ? <span className="badge bg-info text-dark mt-1">Solo Fidelity</span> : null}
                        </td>
                        <td>{c.rewardSummary}</td>
                        <td>{c.validFrom || c.validTo ? `${fmtDate(c.validFrom) || "…"} – ${fmtDate(c.validTo) || "…"}` : <span className="text-muted">Sempre</span>}</td>
                        <td>
                          {c.active ? <span className="badge bg-success">Attiva</span> : <span className="badge bg-secondary">Disattivata</span>}
                          {c.active && c.isCurrentlyActive ? <span className="badge bg-primary ms-1">In corso</span> : null}
                          {c.autoDisabled ? <span className="badge bg-warning text-dark ms-1">Auto-off</span> : null}
                        </td>
                        <td className="text-end">{c.instancesCount}</td>
                        <td className="text-end">
                          <a className="btn btn-sm btn-outline-primary me-1" href={href(`&action=edit&id=${c.id}`)}>
                            <i className="bi bi-pencil" /> Modifica
                          </a>
                          <button className="btn btn-sm btn-outline-secondary me-1" type="button" onClick={() => toggle(c)} disabled={busy}>
                            {c.active ? "Disattiva" : "Attiva"}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(c)} disabled={busy}>
                            <i className="bi bi-trash" /> Elimina
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
