"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP POS "Dettaglio vendita" page (app/pages/pos_sale_detail.php),
// fed by the DB-backed /api/manage/pos route:
//   GET  ?action=sale_detail&id=<id>  -> the sale (header + grouped items + payments +
//                                         totals) + the cancel summary/blockers
//   POST action=cancel                -> annulla vendita (sale_id, reason, stock_cancel_mode)
//   POST action=mark_collected        -> "Segna ritirato" for an ordered product line
//
// SCOPE: the operational CORE (view + cancel + pickup + receipt). The deep stock-document
// internals (partial pickup, undo, the prepaid/preorder "Cronologia utilizzo" tracking
// cards) are intentionally out of scope — see the precise TODOs at the foot of this file.

type PosSaleItemType = "service" | "product" | "prepaid" | "giftcard" | "package" | "giftbox" | "recharge";
type PosSaleItemStatus = "executed" | "prepaid" | "collected" | "ordered";

type PosSaleItem = {
  id: number;
  type: PosSaleItemType;
  refId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: PosSaleItemStatus;
};

type PosPayment = { id: number; method: string; amount: number; giftcardId?: number };

type PosSale = {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  locationId: number;
  items: PosSaleItem[];
  payments: PosPayment[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeDue: number;
  status: "active" | "cancelled";
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
};

type CancelSummary = {
  products: Array<{ saleItemId: number; productId: number; name: string; qty: number }>;
  requiresStockDecision: boolean;
  giftcards: Array<{ id: number; code: string; status: string; balance: number; linkedSaleIds: number[] }>;
  giftboxes: Array<{ id: number; code: string; status: string; fullyRedeemed: boolean; redeemedItems: string[]; remainingItems: string[] }>;
  packages: Array<{ id: number; name: string; sessionsTotal: number; sessionsRemaining: number }>;
  prepaidServices: Array<{ id: number; name: string; purchasedQty: number; remainingQty: number }>;
  recharges: Array<{ id: number; totalAmount: number; isVoid: boolean }>;
  installmentPlans: Array<{ id: number; status: string }>;
  creditRestored: number;
  giftcardResidualRefunded: number;
  giftcardResidualCode: string;
  pointsRestored: number;
  summary: string[];
  warnings: string[];
  blockers: string[];
};

type SaleDetail = {
  ok: boolean;
  sale: PosSale;
  operatorName: string;
  locationName: string;
  cancelSummary: CancelSummary;
  canCancel: boolean;
  canMarkCollected: boolean;
};

type BusinessHeader = { name: string; legalVatNumber: string; address: string; logoPath: string };

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function saleIdFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const id = new URLSearchParams(window.location.search).get("id");
  const n = Number(id ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function fmtMoney(value: number): string {
  return Number(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(value?: string): string {
  if (!value) return "—";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  const d = value.slice(0, 10);
  const [y, mo, day] = d.split("-");
  return day && mo && y ? `${day}/${mo}/${y}` : value;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Contanti",
  card: "Carta",
  transfer: "Bonifico",
  giftcard: "GiftCard",
  wallet: "Credito",
};

function paymentLabel(method: string | undefined): string {
  const key = String(method ?? "").toLowerCase();
  return PAYMENT_LABELS[key] ?? (key || "Pagamento");
}

// Per-item status badge — faithful to _pos_hist_item_status_badge (Eseguito / Prepagato /
// Ritirato / Ordinato). Only product/service lines with a stored status get a badge.
function itemStatusBadge(item: PosSaleItem): { cls: string; label: string } | null {
  if (item.type === "service") {
    if (item.status === "executed") return { cls: "text-bg-success", label: "Eseguito" };
    if (item.status === "prepaid") return { cls: "text-bg-info", label: "Prepagato" };
    return null;
  }
  if (item.type === "product") {
    if (item.status === "collected") return { cls: "text-bg-success", label: "Ritirato" };
    if (item.status === "ordered") return { cls: "text-bg-warning", label: "Ordinato" };
    return null;
  }
  return null;
}

// Group homogeneous sale lines for the view (same type + ref + name + unit price), faithful
// to _pos_hist_group_sale_items_for_view — collapses duplicate lines, sums qty/total, and
// keeps the (single) status when all grouped lines share it.
type GroupedItem = PosSaleItem & { statuses: Set<PosSaleItemStatus> };
function groupSaleItems(items: PosSaleItem[]): GroupedItem[] {
  const groups = new Map<string, GroupedItem>();
  const order: string[] = [];
  for (const it of items) {
    const key = [it.type, String(it.refId), it.name.trim().toLowerCase(), it.unitPrice.toFixed(4)].join("|");
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...it, quantity: it.quantity, total: it.total, statuses: new Set([it.status]) });
      order.push(key);
    } else {
      existing.quantity += it.quantity;
      existing.total = Math.round((existing.total + it.total) * 100) / 100;
      existing.statuses.add(it.status);
    }
  }
  return order.map((k) => {
    const g = groups.get(k)!;
    // Collapse to a single status only when every grouped line agreed (else clear it so no
    // misleading badge shows on a mixed group).
    if (g.statuses.size > 1) g.status = "" as PosSaleItemStatus;
    return g;
  });
}

export function PosSaleDetailContent() {
  const slug = tenantSlug();
  const [saleId] = useState<number>(() => saleIdFromUrl());
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [business, setBusiness] = useState<BusinessHeader | null>(null);
  // Start loading only when there is a valid id to fetch; an invalid id renders the error
  // branch immediately (no effect setState needed, keeping the load effect side-effect-free).
  const [loading, setLoading] = useState(() => saleIdFromUrl() > 0);
  const [error, setError] = useState(() => (saleIdFromUrl() > 0 ? "" : "Vendita non valida."));
  const [flash, setFlash] = useState("");

  // Cancel modal state.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [stockMode, setStockMode] = useState<"restore" | "no_restore">("restore");
  const [busy, setBusy] = useState(false);

  // Receipt overlay.
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Reload trigger: cancel/pickup bump this to refetch the detail (instead of calling
  // setState synchronously inside the effect, the fetch + all setState live in the effect).
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!saleId) return;
    let active = true;
    fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}&action=sale_detail&id=${saleId}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: SaleDetail & { error?: string }) => {
        if (!active) return;
        if (j && j.ok && j.sale) {
          setDetail(j);
          setError("");
        } else {
          setError(j?.error || "Vendita non trovata.");
          setDetail(null);
        }
      })
      .catch(() => {
        if (active) setError("Errore di caricamento.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, saleId, reloadKey]);

  // Business header for the printable receipt (reused from the main POS context).
  useEffect(() => {
    let active = true;
    fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: { business?: BusinessHeader }) => {
        if (active) setBusiness(j?.business ?? null);
      })
      .catch(() => {
        if (active) setBusiness(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const sale = detail?.sale ?? null;
  const summary = detail?.cancelSummary ?? null;
  const isCancelled = sale?.status === "cancelled";
  const groupedItems = useMemo(() => (sale ? groupSaleItems(sale.items) : []), [sale]);
  const clientLabel = sale && sale.clientName && sale.clientName.trim() && sale.clientName.trim() !== "Cliente banco" ? sale.clientName : "Cliente occasionale";
  const backUrl = `/${encodeURIComponent(slug)}/pos_history`;

  // Ordered product lines that can still be picked up (only on a non-cancelled sale).
  const collectableItems = useMemo(
    () => (sale && !isCancelled ? sale.items.filter((it) => it.type === "product" && it.status === "ordered") : []),
    [sale, isCancelled],
  );

  async function postAction(payload: Record<string, string>): Promise<{ ok: boolean; error?: string; sale?: PosSale; cancelSummary?: CancelSummary }> {
    const res = await fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function confirmCancel() {
    if (!sale) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setError("La motivazione e obbligatoria per annullare una vendita.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const json = await postAction({
        action: "cancel",
        sale_id: String(sale.id),
        reason,
        stock_cancel_mode: summary?.requiresStockDecision ? stockMode : "none",
      });
      if (json?.error) {
        setError(json.error);
      } else {
        setCancelOpen(false);
        setCancelReason("");
        setFlash("Vendita annullata.");
        load();
      }
    } catch {
      setError("Errore durante l'annullamento.");
    } finally {
      setBusy(false);
    }
  }

  async function markCollected(saleItemId: number) {
    if (!sale) return;
    setBusy(true);
    setError("");
    try {
      const json = await postAction({ action: "mark_collected", sale_id: String(sale.id), sale_item_id: String(saleItemId) });
      if (json?.error) {
        setError(json.error);
      } else {
        setFlash("Ritiro registrato.");
        load();
      }
    } catch {
      setError("Errore durante la registrazione del ritiro.");
    } finally {
      setBusy(false);
    }
  }

  function printReceipt() {
    try {
      window.print();
    } catch {
      // window.print can be unavailable in embedded contexts — no-op.
    }
  }

  return (
    <div className="container-fluid py-3">
      <link rel="stylesheet" href="/assets/css/pages/pos_history.css" />
      <link rel="stylesheet" href="/assets/css/pages/pos_sale_detail.css" />

      {loading ? (
        <div className="text-muted py-4">Caricamento…</div>
      ) : !sale ? (
        <div className="card p-3">
          <div className="alert alert-danger mb-0">{error || "Vendita non trovata."}</div>
          <div className="mt-3">
            <a className="btn btn-sm btn-outline-primary" href={backUrl}>
              <i className="bi bi-x-lg me-1"></i>Chiudi
            </a>
          </div>
        </div>
      ) : (
        <>
          {flash ? <div className="alert alert-success py-2">{flash}</div> : null}
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          {/* Header card: code, date/time, client (or "Cliente occasionale"), operator,
              location, status badge + actions (Annulla vendita / Stampa scontrino). */}
          <div className="card p-3 mb-3">
            <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
              <div>
                <div className="h5 fw-semibold mb-1">Dettaglio vendita #{sale.id}</div>
                <div className="text-muted small">
                  Data: <strong>{fmtDateTime(sale.createdAt)}</strong>
                  {" • "}Cliente: <strong>{clientLabel}</strong>
                  {detail?.locationName ? (
                    <>
                      {" • "}Sede: <strong>{detail.locationName}</strong>
                    </>
                  ) : null}
                  {detail?.operatorName && detail.operatorName !== "—" ? (
                    <>
                      {" • "}Operatore: <strong>{detail.operatorName}</strong>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {isCancelled ? <span className="badge text-bg-danger">Annullata</span> : <span className="badge text-bg-success">Attiva</span>}
                <a className="btn btn-sm btn-outline-primary" href={backUrl}>
                  <i className="bi bi-x-lg me-1"></i>Chiudi
                </a>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReceiptOpen(true)}>
                  <i className="bi bi-printer me-1"></i>Stampa scontrino
                </button>
                {!isCancelled ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      setCancelOpen(true);
                      setError("");
                    }}
                  >
                    <i className="bi bi-x-circle me-1"></i>Annulla vendita
                  </button>
                ) : null}
              </div>
            </div>

            {/* Cancellation metadata when cancelled. */}
            {isCancelled ? (
              <div className="mt-3">
                <div className="fw-semibold mb-2">Stato annullamento</div>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="small text-muted">Data annullamento</div>
                    <div className="fw-semibold">{sale.cancelledAt ? fmtDateTime(sale.cancelledAt) : "—"}</div>
                  </div>
                  <div className="col-12 col-md-8">
                    <div className="small text-muted">Motivo</div>
                    <div className="fw-semibold">{sale.cancelReason || "—"}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* "Segna ritirato": ordered product lines awaiting pickup. */}
          {collectableItems.length > 0 ? (
            <div className="card p-3 mb-3">
              <div className="fw-semibold mb-1">Ritiro prodotti ordinati</div>
              <div className="small text-muted mb-2">Prodotti in attesa di ritiro collegati a questa vendita.</div>
              <div className="d-flex flex-column gap-2">
                {collectableItems.map((it) => (
                  <div key={it.id} className="border rounded p-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <span className="fw-semibold">{it.name}</span>
                      <span className="text-muted small ms-2">x{it.quantity}</span>
                      <span className="badge text-bg-warning ms-2">Ordinato</span>
                    </div>
                    <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => markCollected(it.id)}>
                      <i className="bi bi-check2-circle me-1"></i>Segna ritirato
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Riepilogo vendita: grouped items + status badges, and the totals panel. */}
          <div className="card p-3 mb-3">
            <div className="border rounded p-3 sale-summary-box">
              <div className="sale-summary-heading mb-2">
                <div className="fw-semibold">Riepilogo vendita</div>
              </div>
              <div className="row g-3">
                <div className="col-12 col-lg-7">
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Elemento</th>
                          <th className="text-end">Qtà</th>
                          <th className="text-end">Prezzo</th>
                          <th className="text-end">Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-muted">
                              Nessun dettaglio righe disponibile.
                            </td>
                          </tr>
                        ) : (
                          groupedItems.map((it, idx) => {
                            const badge = itemStatusBadge(it);
                            return (
                              <tr key={`${it.type}-${it.refId}-${idx}`}>
                                <td>
                                  <div className="fw-semibold">
                                    {it.name || "—"}
                                    {badge ? <span className={`badge rounded-pill ms-2 ${badge.cls}`}>{badge.label}</span> : null}
                                  </div>
                                </td>
                                <td className="text-end">{it.quantity}</td>
                                <td className="text-end">€ {fmtMoney(it.unitPrice)}</td>
                                <td className="text-end fw-semibold">€ {fmtMoney(it.total)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="col-12 col-lg-5">
                  <div className="sale-total-panel">
                    <div className="d-flex justify-content-between gap-3">
                      <span>Subtotale</span>
                      <strong>€ {fmtMoney(sale.subtotal)}</strong>
                    </div>
                    {sale.discount > 0.00001 ? (
                      <div className="d-flex justify-content-between gap-3 text-muted">
                        <span>Riduzioni</span>
                        <span>- € {fmtMoney(sale.discount)}</span>
                      </div>
                    ) : null}
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between gap-3 fs-5">
                      <span>Totale</span>
                      <strong>€ {fmtMoney(sale.total)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payments breakdown. */}
            <div className="border rounded p-3 mt-3">
              <div className="fw-semibold mb-2">Pagamento</div>
              {sale.payments.filter((p) => Number(p.amount ?? 0) > 0).length === 0 ? (
                <div className="text-muted small">Nessun pagamento registrato.</div>
              ) : (
                sale.payments
                  .filter((p) => Number(p.amount ?? 0) > 0)
                  .map((p, idx) => (
                    <div className="d-flex justify-content-between small" key={p.id ?? idx}>
                      <span className="text-muted">{paymentLabel(p.method)}</span>
                      <span>€ {fmtMoney(p.amount)}</span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Cancel modal: summary of what is cancelled/restored, blockers, stock decision,
              required reason. Faithful to the legacy cancelSaleModal. */}
          {cancelOpen ? (
            <div className="pos-sale-cancel-overlay" role="dialog" aria-modal="true" aria-label="Annulla vendita">
              <style>{`
                .pos-sale-cancel-overlay { position: fixed; inset: 0; z-index: 1080; display: flex; align-items: flex-start; justify-content: center; overflow: auto; padding: 1.5rem; background: rgba(15,23,42,.55); }
                .pos-sale-cancel-dialog { width: 100%; max-width: 560px; margin: auto; }
              `}</style>
              <div className="pos-sale-cancel-dialog card p-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="h6 fw-semibold mb-0">Annulla vendita #{sale.id}</div>
                  <button type="button" className="btn-close" aria-label="Chiudi" onClick={() => setCancelOpen(false)}></button>
                </div>

                {summary && summary.blockers.length > 0 ? (
                  <div className="alert alert-danger">
                    <div className="fw-semibold mb-1">Annullamento non consentito</div>
                    <ul className="mb-0 ps-3">
                      {summary.blockers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary && summary.summary.length > 0 ? (
                  <div className="mb-2">
                    <div className="small text-muted mb-1">Verranno annullati / ripristinati:</div>
                    <ul className="small mb-0 ps-3">
                      {summary.summary.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary && summary.warnings.length > 0 ? (
                  <div className="alert alert-warning py-2">
                    <ul className="small mb-0 ps-3">
                      {summary.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary && summary.requiresStockDecision ? (
                  <div className="mb-2">
                    <div className="small fw-semibold mb-1">Magazzino prodotti</div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="stockMode"
                        id="stockRestore"
                        checked={stockMode === "restore"}
                        onChange={() => setStockMode("restore")}
                      />
                      <label className="form-check-label" htmlFor="stockRestore">
                        Ripristina la giacenza dei prodotti
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="stockMode"
                        id="stockNoRestore"
                        checked={stockMode === "no_restore"}
                        onChange={() => setStockMode("no_restore")}
                      />
                      <label className="form-check-label" htmlFor="stockNoRestore">
                        Non ripristinare la giacenza
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="mb-2">
                  <label className="form-label small fw-semibold" htmlFor="cancelReason">
                    Motivo (obbligatorio)
                  </label>
                  <textarea
                    id="cancelReason"
                    className="form-control form-control-sm"
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={Boolean(summary && summary.blockers.length > 0)}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCancelOpen(false)}>
                    Indietro
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={busy || Boolean(summary && summary.blockers.length > 0) || !cancelReason.trim()}
                    onClick={confirmCancel}
                  >
                    <i className="bi bi-x-circle me-1"></i>Conferma annullamento
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Printable receipt (scontrino): reuses the pos-content approach — a scoped @media
              print rule isolates the receipt so only it prints. */}
          {receiptOpen ? (
            <div className="pos-receipt-overlay" role="dialog" aria-modal="true" aria-label="Ricevuta vendita">
              <style>{`
                .pos-receipt-overlay { position: fixed; inset: 0; z-index: 1080; display: flex; align-items: flex-start; justify-content: center; overflow: auto; padding: 1.5rem; background: rgba(15,23,42,.55); }
                .pos-receipt { width: 100%; max-width: 460px; margin: auto; background: #fff; border-radius: .5rem; }
                @media print {
                  body * { visibility: hidden !important; }
                  .pos-receipt-overlay, .pos-receipt-overlay * { visibility: visible !important; }
                  .pos-receipt-overlay { position: absolute !important; inset: 0 !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
                  .pos-receipt { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; }
                  .pos-receipt-actions { display: none !important; }
                }
              `}</style>
              <div className="pos-receipt card p-4">
                <div className="text-center mb-3">
                  {business?.logoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoPath} alt="" className="mb-2" style={{ maxHeight: 64, maxWidth: 180, objectFit: "contain" }} />
                  ) : null}
                  <div className="h5 mb-0 fw-bold">{business?.name || "—"}</div>
                  {business?.legalVatNumber ? <div className="small text-muted">P.IVA {business.legalVatNumber}</div> : null}
                  {business?.address ? <div className="small text-muted">{business.address}</div> : null}
                </div>
                <hr />
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div className="fw-semibold">{sale.code || `#${sale.id}`}</div>
                    <div className="text-muted small">{fmtDateTime(sale.createdAt)}</div>
                  </div>
                  <div className="text-end small">
                    <div className="text-muted">Cliente</div>
                    <div className="fw-semibold">{clientLabel}</div>
                  </div>
                </div>
                <div className="table-responsive mt-2">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Elemento</th>
                        <th className="text-end">Q.tà</th>
                        <th className="text-end">Prezzo</th>
                        <th className="text-end">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedItems.map((it, idx) => (
                        <tr key={`r-${idx}`}>
                          <td>{it.name || "Elemento"}</td>
                          <td className="text-end">{it.quantity}</td>
                          <td className="text-end">€ {fmtMoney(it.unitPrice)}</td>
                          <td className="text-end fw-semibold">€ {fmtMoney(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <hr />
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Subtotale</span>
                  <span>€ {fmtMoney(sale.subtotal)}</span>
                </div>
                {sale.discount > 0.00001 ? (
                  <div className="d-flex justify-content-between text-muted small mt-1">
                    <span>Riduzioni</span>
                    <span className="text-danger">- € {fmtMoney(sale.discount)}</span>
                  </div>
                ) : null}
                <hr />
                <div className="d-flex justify-content-between">
                  <span className="fw-semibold">Totale</span>
                  <span className="fw-semibold">€ {fmtMoney(sale.total)}</span>
                </div>
                <div className="mt-3">
                  <div className="fw-semibold mb-1">Pagamento</div>
                  {sale.payments
                    .filter((p) => Number(p.amount ?? 0) > 0)
                    .map((p, idx) => (
                      <div className="d-flex justify-content-between small" key={`rp-${idx}`}>
                        <span className="text-muted">{paymentLabel(p.method)}</span>
                        <span>€ {fmtMoney(p.amount)}</span>
                      </div>
                    ))}
                </div>
                <div className="pos-receipt-actions d-flex gap-2 justify-content-end mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setReceiptOpen(false)}>
                    Chiudi
                  </button>
                  <button type="button" className="btn btn-primary" onClick={printReceipt}>
                    <i className="bi bi-printer me-1"></i>Stampa scontrino
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
