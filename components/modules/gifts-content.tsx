"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP fidelity/gifts page (app/pages/gifts.php), fed by the
// existing DB-backed /api/manage/gifts. Reproduces the original Bootstrap markup
// (bs-page-header, gifts empty-state card) verbatim. When the API returns issued
// gift instances, they are rendered in a simple instances table mapped from the
// GiftReward shape exposed by the API.

type Gift = {
  id: number;
  clientId: number;
  clientName: string;
  title: string;
  rewardType: "service" | "product" | "discount";
  value: number;
  status: "available" | "redeemed" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  redeemedAt?: string;
};

// Map of API gift status -> { label, Bootstrap badge class } used in the table.
const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  available: { label: "Disponibile", cls: "text-bg-success" },
  redeemed: { label: "Riscattato", cls: "text-bg-secondary" },
  expired: { label: "Scaduto", cls: "text-bg-warning" },
  cancelled: { label: "Annullato", cls: "text-bg-dark" },
};

// Reward type labels (service / product / discount), reproduced from PHP wording.
const REWARD_TYPE_LABELS: Record<string, string> = {
  service: "Servizio",
  product: "Prodotto",
  discount: "Sconto",
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : "—";
}

function statusBadge(status: string): { label: string; cls: string } {
  return STATUS_BADGES[status] ?? { label: status || "—", cls: "text-bg-secondary" };
}

function rewardTypeLabel(type: string): string {
  return REWARD_TYPE_LABELS[type] ?? "—";
}

export function GiftsContent() {
  const slug = tenantSlug();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter form state (legacy gifts list filters by client / status).
  const [clientId, setClientId] = useState("0");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ clientId: "0", status: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/gifts?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setGifts(Array.isArray(j.gifts) ? j.gifts : []))
      .catch(() => setGifts([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Distinct client list for the filter combobox, derived from loaded gifts.
  const clientItems = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gifts) {
      if (g.clientId > 0) map.set(String(g.clientId), g.clientName || "Cliente");
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [gifts]);

  // Client-side filtering (the API exposes no filter params).
  const filtered = useMemo(() => {
    return gifts.filter((g) => {
      if (applied.clientId && applied.clientId !== "0" && String(g.clientId) !== applied.clientId) return false;
      if (applied.status && g.status !== applied.status) return false;
      return true;
    });
  }, [gifts, applied]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/${`gifts${suffix}`.replace("&", "?")}`;
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

      {!loading && gifts.length === 0 ? (
        <div className="card border-0 shadow-sm gifts-empty-card">
          <div className="gifts-empty-state">
            <div className="gifts-empty-icon" aria-hidden="true">
              <i className="bi bi-gift" />
            </div>
            <h2>Nessun omaggio configurato</h2>
            <p>
              Crea una campagna omaggio per iniziare ad assegnare premi ai clienti e seguirne accumulo, disponibilità e
              riscatto.
            </p>
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
            <form
              className="row g-2 align-items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setApplied({ clientId, status });
              }}
            >
              <div className="col-lg-4">
                <label className="form-label">Cliente</label>
                <select className="form-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="0">Tutti</option>
                  {clientItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-lg-3">
                <label className="form-label">Stato</label>
                <select className="form-select" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Tutti</option>
                  <option value="available">Disponibile</option>
                  <option value="redeemed">Riscattato</option>
                  <option value="expired">Scaduto</option>
                  <option value="cancelled">Annullato</option>
                </select>
              </div>

              <div className="col-lg-3 d-flex align-items-center gap-3 flex-wrap app-filter-actions">
                <button className="btn btn-outline-primary app-filter-submit" type="submit">
                  <i className="bi bi-search me-1" />
                  Filtra
                </button>
                <a
                  className="btn btn-outline-secondary app-filter-reset"
                  href={href("")}
                  onClick={(e) => {
                    e.preventDefault();
                    setClientId("0");
                    setStatus("");
                    setApplied({ clientId: "0", status: "" });
                  }}
                >
                  Reset
                </a>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Omaggio</th>
                    <th>Tipo</th>
                    <th>Stato</th>
                    <th>Scadenza</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted small p-3">
                        {loading ? "Caricamento…" : "Nessun omaggio."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((g) => {
                      const badge = statusBadge(g.status);
                      return (
                        <tr key={g.id}>
                          <td className="fw-semibold">{g.clientName || "—"}</td>
                          <td>{g.title || "—"}</td>
                          <td className="text-muted small">{rewardTypeLabel(g.rewardType)}</td>
                          <td>
                            <span className={`badge ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="text-muted small">{fmtDate(g.expiresAt)}</td>
                          <td className="text-end">
                            <a className="btn btn-sm btn-outline-secondary" href={href(`&action=view&id=${g.id}`)}>
                              Apri
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
        </>
      )}
    </div>
  );
}
