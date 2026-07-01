"use client";

import { useEffect, useState } from "react";

// Faithful port of the PHP giftbox INSTANCE detail (giftbox.php tab=instances
// action=edit_instance), fed by /api/manage/giftboxes?action=view&id=<id>:
//   - header (GiftBox / codice / destinatario / stato / date / punti / vendita)
//   - Contenuti (giftbox_instance_items) + unità totali/riscattate/residue
//   - actions: Riscatta (full redeem) + Annulla (cancel)
// The per-item PARTIAL redeem UI is deferred (appointments already redeem items).

type Item = { id: number; itemType: string; name: string; qty: number };
type Detail = {
  id: number;
  code: string;
  giftboxName: string;
  recipientName: string;
  recipientEmail: string;
  clientId: number;
  status: string;
  statusLabel: string;
  statusBadge: string;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string;
  cancelledAt: string;
  pointsCost: number;
  note: string;
  items: Item[];
  totalUnits: number;
  redeemedUnits: number;
  remainingUnits: number;
  linkedSaleId: number | null;
  canRedeem: boolean;
  canCancel: boolean;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}
function instanceIdFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const n = Number.parseInt(new URLSearchParams(window.location.search).get("id") ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function fmtDate(v: string): string {
  const s = (v ?? "").slice(0, 10);
  if (s === "") return "—";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

export function GiftBoxInstanceDetailContent() {
  const slug = tenantSlug();
  const [id, setId] = useState(0);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const gid = instanceIdFromUrl();
    if (gid > 0) setId(gid);
    else {
      setError("GiftBox non valida.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    fetch(`/api/manage/giftboxes?slug=${encodeURIComponent(slug)}&action=view&id=${id}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j && j.ok && j.detail) {
          setData(j.detail);
          setError("");
        } else {
          setError(j?.error || "GiftBox non trovata.");
        }
      })
      .catch(() => {
        if (active) setError("Errore nel caricamento della GiftBox.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, slug, reloadKey]);

  function page(suffix: string): string {
    return `/${encodeURIComponent(slug)}/${`${suffix}`.replace("&", "?")}`;
  }

  async function act(action: "redeem_full" | "cancel", confirmMsg: string, okMsg: string) {
    if (busy) return;
    if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError("");
    setFlash("");
    try {
      const res = await fetch(`/api/manage/giftboxes?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({ action, instance_id: String(id) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) {
        setError(String(j?.error ?? "Operazione non riuscita."));
      } else {
        setFlash(okMsg);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/giftbox.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">GiftBox emessa</div>
          <h1 className="bs-page-title">{data?.giftboxName || "GiftBox"}</h1>
          <div className="bs-page-subtitle">{data ? `Codice ${data.code}` : "Dettaglio GiftBox."}</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary" href={page("giftbox")}>
            <i className="bi bi-arrow-left me-1" />
            GiftBox emesse
          </a>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {flash ? <div className="alert alert-success">{flash}</div> : null}

      {loading ? (
        <div className="card p-3 text-muted small">Caricamento…</div>
      ) : data ? (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className={`badge ${data.statusBadge}`}>{data.statusLabel}</span>
                {data.linkedSaleId ? (
                  <a className="btn btn-sm btn-outline-secondary" href={page(`pos_sale_detail&id=${data.linkedSaleId}`)}>
                    Vendita #{data.linkedSaleId}
                  </a>
                ) : null}
              </div>
              <div className="display-6 fw-bold">
                {data.remainingUnits} <span className="fs-6 text-muted">/ {data.totalUnits} residue</span>
              </div>
              <div className="text-muted small mt-2">
                <div>Destinatario: {data.recipientName || "—"}</div>
                {data.recipientEmail ? <div>Email: {data.recipientEmail}</div> : null}
                {data.clientId ? (
                  <div>
                    Cliente: <a href={page(`clients&action=view&id=${data.clientId}`)}>#{data.clientId}</a>
                  </div>
                ) : null}
                <div>Emessa: {fmtDate(data.issuedAt)}</div>
                <div>Scadenza: {fmtDate(data.expiresAt)}</div>
                {data.redeemedAt ? <div>Riscattata: {fmtDate(data.redeemedAt)}</div> : null}
                {data.cancelledAt ? <div>Annullata: {fmtDate(data.cancelledAt)}</div> : null}
                {data.pointsCost > 0 ? <div>Costo punti: {data.pointsCost}</div> : null}
              </div>
            </div>

            {data.canRedeem || data.canCancel ? (
              <div className="card p-3 mt-3">
                <div className="fw-semibold mb-2">Azioni</div>
                <div className="d-grid gap-2">
                  {data.canRedeem ? (
                    <button className="btn btn-outline-success" type="button" disabled={busy} onClick={() => act("redeem_full", "Riscattare completamente questa GiftBox?", "GiftBox riscattata.")}>
                      <i className="bi bi-check2-circle me-1" />
                      Riscatta completamente
                    </button>
                  ) : null}
                  {data.canCancel ? (
                    <button className="btn btn-outline-danger" type="button" disabled={busy} onClick={() => act("cancel", "Annullare questa GiftBox?", "GiftBox annullata.")}>
                      <i className="bi bi-slash-circle me-1" />
                      Annulla GiftBox
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-lg-8">
            <div className="card">
              <div className="card-header fw-semibold">
                <i className="bi bi-collection me-2" />
                Contenuti
              </div>
              <div className="table-responsive">
                <table className="table mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Voce</th>
                      <th>Tipo</th>
                      <th className="text-end">Q.tà</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted p-3">
                          Nessun contenuto.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((it) => (
                        <tr key={it.id}>
                          <td className="fw-semibold">{it.name}</td>
                          <td className="text-muted">{it.itemType === "product" ? "Prodotto" : it.itemType === "service" ? "Servizio" : "Personalizzato"}</td>
                          <td className="text-end">{it.qty}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="card-footer text-muted small">
                Unità totali: {data.totalUnits} · Riscattate: {data.redeemedUnits} · Residue: {data.remainingUnits}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
