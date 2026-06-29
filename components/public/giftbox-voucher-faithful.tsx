"use client";

/*
 * GiftBoxVoucherFaithful — pixel-faithful Next.js port of the legacy PHP PUBLIC
 * GiftBox voucher page (legacy source: C:/xampp/htdocs/app/pages/giftbox_voucher.php,
 * styled by /assets/css/pages/giftbox_voucher.css). The legacy public link is
 * index.php?page=giftbox_voucher&public=1&embed=1&token=<64hex>.
 *
 * The PHP page rendered a `.voucher-wrap` card (Bootstrap classes) with the
 * business header, status badge, GiftBox name/description, sender/recipient,
 * validity dates, the contents table (with used/remaining columns), the
 * dedication message, the client note, the conditions list, and a barcode panel
 * encoding the GiftBox code. This component reproduces that markup VERBATIM and
 * fills it from /api/public/giftbox-voucher?slug=&token=.
 *
 * EMBED MODE (embed=1): the legacy app rendered the page chrome-less inside the
 * email iframe. Here `embed` swaps document.body to a white chrome-less body and
 * hides the print toolbar (the .no-print row). The print/hide-amount buttons are
 * only shown OUT of embed; the public voucher never exposes the hide-amount
 * toggle (PHP gated it behind !$isPublic), so it is dropped entirely.
 *
 * The barcode uses JsBarcode from the same CDN as the PHP page; if it fails to
 * load the code is still shown in plain text underneath.
 *
 * Simplified vs PHP (TODO):
 *   - The event hero image (GiftBox::eventTemplateInfo image_abs) is NOT shown:
 *     those images live under the PHP /assets tree and need a tenant base URL.
 *   - The header logo (<img src="index.php?page=logo">) is dropped: the Next app
 *     has no public logo endpoint here.
 */

import { useEffect, useRef, useState } from "react";

const CSS_LINKS = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
  "/assets/css/pages/giftbox_voucher.css",
];

const DEFAULT_TERMS = [
  "Voucher utilizzabile in più appuntamenti fino ad esaurimento del contenuto.",
  "Ad ogni utilizzo verranno scalati i singoli servizi/prodotti (riscatto parziale).",
  "Non convertibile in denaro e non rimborsabile.",
  "Presentare il codice a barre o il codice alfanumerico in cassa per il riscatto.",
];

type VoucherItem = {
  id: number;
  type: string;
  label: string;
  qty: number;
  used: number;
  remaining: number;
  price: number | null;
};

type Voucher = {
  code: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string;
  cancelledAt: string;
  lastRedeemAt: string;
  recipientName: string;
  recipientEmail: string;
  clientName: string;
  giftboxName: string;
  giftboxDescription: string;
  giftMessage: string;
  note: string;
  hideAmount: boolean;
  totalUnits: number;
  remainingUnits: number;
  items: VoucherItem[];
};

type Business = {
  name: string;
  address: string;
  phone: string;
  email: string;
  terms: string;
};

type StatusMeta = { code: string; badge: string; label: string; watermark: string };

// Port of giftbox_voucher_status_meta().
function statusMeta(status: string): StatusMeta {
  const code = status.trim().toLowerCase();
  let badge = "secondary";
  let label = code !== "" ? code.charAt(0).toUpperCase() + code.slice(1) : "—";
  let watermark = "";
  switch (code) {
    case "issued":
    case "active":
      badge = "primary";
      label = "Attiva";
      break;
    case "redeemed":
      badge = "success";
      label = "Riscattata";
      watermark = "RISCATTATA";
      break;
    case "expired":
      badge = "danger";
      label = "Scaduta";
      watermark = "SCADUTA";
      break;
    case "cancelled":
    case "canceled":
      badge = "secondary";
      label = "Annullata";
      watermark = "ANNULLATA";
      break;
  }
  return { code, badge, label, watermark };
}

function isEmptyDate(value: string): boolean {
  const v = String(value ?? "").trim();
  return v === "" || v.startsWith("0000-00-00");
}

// PHP $fmt — d/m/Y H:i, "—" when empty/invalid.
function fmtDateTime(dt: string): string {
  if (isEmptyDate(dt)) return "—";
  const ts = Date.parse(String(dt).replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// PHP $fmtDate — d/m/Y, "—" when empty/invalid.
function fmtDate(dt: string): string {
  if (isEmptyDate(dt)) return "—";
  const ts = Date.parse(String(dt).replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// number_format($v, 2, ',', '.') — Italian money.
function moneyIt(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}${withThousands},${decPart}`;
}

// Conditions list: businesses.giftbox_terms overrides the defaults; strip the
// leading bullet and substitute {BUSINESS_NAME} tokens (PHP terms loop).
function buildTerms(termsRaw: string, bizName: string): string[] {
  const norm = String(termsRaw ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = norm === "" ? DEFAULT_TERMS : norm.split(/\n+/);
  const out: string[] = [];
  for (const raw of lines) {
    let ln = String(raw).trim();
    if (ln === "") continue;
    ln = ln.replace(/^[-•\t\s]+/u, "");
    ln = ln.split("{BUSINESS_NAME}").join(bizName).split("{{BUSINESS_NAME}}").join(bizName).split("%BUSINESS_NAME%").join(bizName);
    out.push(ln);
  }
  return out;
}

export function GiftBoxVoucherFaithful({ slug, token, embed }: { slug: string; token: string; embed: boolean }) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  // Chrome-less embed body (mirrors the legacy embed iframe shell).
  useEffect(() => {
    if (!embed) return;
    const previous = document.body.className;
    document.body.className = "embed-body";
    document.body.style.background = "#fff";
    return () => {
      document.body.className = previous;
      document.body.style.background = "";
    };
  }, [embed]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/public/giftbox-voucher?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !data.ok) {
          setError(String(data.error ?? "Voucher GiftBox non trovato."));
          return;
        }
        setVoucher(data.voucher as Voucher);
        setBusiness(data.business as Business);
        setError("");
      })
      .catch(() => {
        if (active) setError("Voucher GiftBox non trovato.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, token]);

  // Render the barcode once data + JsBarcode are available (matches the PHP
  // giftbox_voucher.js JsBarcode init: CODE128, the GiftBox code, no value text).
  useEffect(() => {
    const code = voucher?.code ?? "";
    if (!code || !barcodeRef.current) return;
    let cancelled = false;

    function draw() {
      const win = window as typeof window & { JsBarcode?: (el: Element, value: string, opts: object) => void };
      if (cancelled || !win.JsBarcode || !barcodeRef.current) return;
      try {
        win.JsBarcode(barcodeRef.current, code, {
          format: "CODE128",
          displayValue: false,
          height: 70,
          margin: 0,
        });
      } catch {
        // leave the code visible in plain text below
      }
    }

    const win = window as typeof window & { JsBarcode?: unknown };
    if (win.JsBarcode) {
      draw();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
    script.async = true;
    script.onload = draw;
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [voucher?.code]);

  if (loading) {
    return (
      <>
        {CSS_LINKS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <div className="voucher-wrap">
          <div className="card p-4 voucher-card">
            <div className="text-muted">Caricamento…</div>
          </div>
        </div>
      </>
    );
  }

  if (error || !voucher || !business) {
    return (
      <>
        {CSS_LINKS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <div className="voucher-wrap">
          <div className="alert alert-danger" role="alert">
            {error || "Voucher GiftBox non trovato."}
          </div>
        </div>
      </>
    );
  }

  const meta = statusMeta(voucher.status);
  // Partial-redemption watermark (PHP: status issued + some redeemed + some left).
  const partialRedeemed =
    meta.code === "issued" && voucher.totalUnits - voucher.remainingUnits > 0 && voucher.remainingUnits > 0;
  const watermark = partialRedeemed ? "PARZIALE" : meta.watermark;

  const showPrices = !voucher.hideAmount;
  const dest =
    voucher.recipientName !== "" ? voucher.recipientName : voucher.recipientEmail !== "" ? voucher.recipientEmail : "—";
  const terms = buildTerms(business.terms, business.name);

  let giftboxName = voucher.giftboxName.trim();
  if (giftboxName === "") giftboxName = "GiftBox";
  if (/^POS\s*•\s*GiftBox/i.test(giftboxName) || /\bCliente\s+\d+\b/i.test(giftboxName)) giftboxName = "GiftBox";

  return (
    <>
      {CSS_LINKS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <div className="voucher-wrap">
        {/* Print toolbar — only when NOT embedded (chrome-less embed hides it). */}
        {!embed ? (
          <div className="d-flex justify-content-end align-items-center mb-3 no-print">
            <div className="d-flex gap-2">
              <button className="btn btn-primary" type="button" onClick={() => window.print()}>
                <i className="bi bi-printer me-1" />
                Stampa / Salva PDF
              </button>
            </div>
          </div>
        ) : null}

        <div className="card p-4 voucher-card">
          {watermark !== "" ? <div className="voucher-watermark">{watermark}</div> : null}

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3">
            <div className="d-flex align-items-start gap-3">
              <div>
                <div className="text-muted small">Voucher GiftBox</div>
                <div className="h5 fw-bold mb-0">{business.name}</div>
                {business.address !== "" ? <div className="text-muted small">{business.address}</div> : null}
                {business.phone !== "" || business.email !== "" ? (
                  <div className="text-muted small">
                    {business.phone !== "" ? <span>{business.phone}</span> : null}
                    {business.phone !== "" && business.email !== "" ? <span className="mx-1">•</span> : null}
                    {business.email !== "" ? <span>{business.email}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="text-md-end">
              <div className="mt-1">
                <span className={`badge text-bg-${meta.badge} text-uppercase`}>{meta.label}</span>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="h5 fw-semibold mb-1">{giftboxName}</div>
              {voucher.giftboxDescription !== "" ? (
                <div className="text-muted mb-2 giftbox-voucher-prewrap">{voucher.giftboxDescription}</div>
              ) : null}

              <div className="row g-2 voucher-meta">
                <div className="col-md-6">
                  <div className="label">Mittente</div>
                  <div className="value">{voucher.clientName !== "" ? voucher.clientName : "—"}</div>
                </div>
                <div className="col-md-6">
                  <div className="label">Destinatario</div>
                  <div className="value">{dest}</div>
                </div>
                <div className="col-md-3">
                  <div className="label">Valida dal</div>
                  <div className="value">{fmtDate(voucher.issuedAt)}</div>
                </div>
                <div className="col-md-3">
                  <div className="label">Valida fino al</div>
                  <div className="value">{fmtDate(voucher.expiresAt)}</div>
                </div>
                <div className="col-md-3">
                  <div className="label">Riscatto</div>
                  <div className="value">
                    {meta.code === "redeemed" ? (
                      fmtDateTime(voucher.redeemedAt)
                    ) : meta.code === "cancelled" ? (
                      fmtDateTime(voucher.cancelledAt)
                    ) : voucher.lastRedeemAt !== "" ? (
                      <>
                        {fmtDateTime(voucher.lastRedeemAt)} <span className="text-muted">(parziale)</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="label">Rimanenti</div>
                  <div className="value">
                    {voucher.totalUnits > 0 ? `${voucher.remainingUnits} / ${voucher.totalUnits}` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="fw-semibold mb-2">Contenuto GiftBox</div>
                <div className="border rounded-3 overflow-hidden">
                  <table className="table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Voce</th>
                        {showPrices ? <th className="text-end giftbox-voucher-col-price">Prezzo listino</th> : null}
                        <th className="text-end giftbox-voucher-col-total">Tot</th>
                        <th className="text-end giftbox-voucher-col-used">Usata</th>
                        <th className="text-end giftbox-voucher-col-remaining">Rimanente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucher.items.map((it) => {
                        const priceText =
                          showPrices && it.price !== null ? `€ ${moneyIt(it.price)}` : "—";
                        return (
                          <tr key={it.id} className={it.remaining <= 0 ? "text-muted" : ""}>
                            <td>
                              {it.remaining <= 0 ? (
                                <>
                                  <span className="text-decoration-line-through">{it.label}</span>
                                  <span className="badge text-bg-light ms-2">esaurito</span>
                                </>
                              ) : (
                                it.label
                              )}
                            </td>
                            {showPrices ? <td className="text-end">{priceText}</td> : null}
                            <td className="text-end fw-semibold">{it.qty}</td>
                            <td className="text-end">{it.used}</td>
                            <td className="text-end">{it.remaining}</td>
                          </tr>
                        );
                      })}
                      {!voucher.items.length ? (
                        <tr>
                          <td colSpan={showPrices ? 5 : 4} className="text-muted p-3">
                            Nessun contenuto configurato.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {voucher.giftMessage !== "" ? (
                <div className="mt-4">
                  <div className="fw-semibold text-dark mb-1">Messaggio di dedica</div>
                  <div className="text-muted giftbox-voucher-prewrap">{voucher.giftMessage}</div>
                </div>
              ) : null}

              {voucher.note !== "" ? (
                <div className="mt-3">
                  <div className="fw-semibold text-dark mb-1">Nota per il cliente</div>
                  <div className="text-muted giftbox-voucher-prewrap">{voucher.note}</div>
                </div>
              ) : null}

              <div className="mt-4 text-muted small">
                <div className="fw-semibold text-dark">Condizioni</div>
                <ul className="mb-0">
                  {terms.map((ln, idx) => (
                    <li key={idx}>{ln}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="border rounded-3 p-3 text-center">
                <div className="text-muted small mb-2">Scansiona codice a barre</div>
                <div className="d-flex justify-content-center">
                  <svg id="barcode" ref={barcodeRef} />
                </div>
                <div className="mt-2 small text-muted">
                  Codice: <strong>{voucher.code}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default GiftBoxVoucherFaithful;
