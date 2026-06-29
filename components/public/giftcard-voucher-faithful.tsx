"use client";

/*
 * GiftCardVoucherFaithful — pixel-faithful Next.js port of the legacy PHP PUBLIC
 * GiftCard voucher page (legacy source: C:/xampp/htdocs/app/pages/giftcard_voucher.php,
 * styled by /assets/css/pages/giftcard_voucher.css). The legacy public link is
 * index.php?page=giftcard_voucher&public=1&embed=1&token=<64hex>.
 *
 * The PHP page rendered a `.voucher-wrap` card (Bootstrap classes) with the
 * business header (structured site_* address lines) + status badge, an intro
 * line that varies with money/items/hide-amount, sender/recipient, the value /
 * balance / dates meta grid, the gift contents list, the dedication message,
 * the client note, the conditions list, and a barcode panel encoding the
 * GiftCard code. This component reproduces that markup VERBATIM and fills it
 * from /api/public/giftcard-voucher?slug=&token=.
 *
 * EMBED MODE (embed=1): the legacy app rendered the page chrome-less inside the
 * email iframe. Here `embed` swaps document.body to a chrome-less white body and
 * hides the print toolbar. The hide-amount toggle was gated behind !$isPublic in
 * the PHP, so the public voucher never shows it — dropped entirely.
 *
 * The barcode uses JsBarcode from the same CDN as the PHP page; if it fails to
 * load the code is still shown in plain text underneath.
 *
 * Simplified vs PHP (TODO):
 *   - The event hero image (GiftCard::eventTemplateInfo image) is NOT shown:
 *     those images live under the PHP /assets tree and need a tenant base URL.
 *   - The header logo (<img src="index.php?page=logo">) is dropped: the Next app
 *     has no public logo endpoint here.
 */

import { useEffect, useRef, useState } from "react";

const CSS_LINKS = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
  "/assets/css/pages/giftcard_voucher.css",
];

const DEFAULT_TERMS_TPL = [
  "La GiftCard è utilizzabile fino a esaurimento credito e/o fino all'utilizzo dei servizi/prodotti inclusi, oppure fino alla data di scadenza (se presente).",
  "Non convertibile in denaro e non rimborsabile.",
  "Presentare il codice a barre o il codice alfanumerico in cassa per l'utilizzo.",
  "In caso di smarrimento, contatta {BUSINESS_NAME} indicando il codice GiftCard.",
];

type VoucherItem = { type: string; name: string; qty: number };

type Voucher = {
  code: string;
  status: string;
  initialAmount: number;
  balance: number;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string;
  cancelledAt: string;
  recipientName: string;
  recipientEmail: string;
  clientName: string;
  giftMessage: string;
  note: string;
  hideAmount: boolean;
  items: VoucherItem[];
};

type Business = {
  name: string;
  addrLine1: string;
  addrLine2: string;
  addrLine3: string;
  phone: string;
  email: string;
  terms: string;
};

type StatusMeta = { code: string; badge: string; label: string; watermark: string };

// Port of giftcard_voucher_status_meta().
function statusMeta(status: string): StatusMeta {
  const code = status.trim().toLowerCase();
  let badge = "secondary";
  let label = code !== "" ? code.charAt(0).toUpperCase() + code.slice(1) : "—";
  let watermark = "";
  switch (code) {
    case "active":
      badge = "success";
      label = "Attiva";
      break;
    case "redeemed":
      badge = "info";
      label = "Riscattata";
      watermark = "ESAURITA";
      break;
    case "expired":
      badge = "warning";
      label = "Scaduta";
      watermark = "SCADUTA";
      break;
    case "cancelled":
    case "canceled":
      badge = "danger";
      label = "Annullata";
      watermark = "ANNULLATA";
      break;
  }
  return { code, badge, label, watermark };
}

// PHP $fmt — d/m/Y H:i, "—" when empty/invalid.
function fmtDateTime(dt: string): string {
  const s = String(dt ?? "").trim();
  if (s === "") return "—";
  const ts = Date.parse(s.replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// PHP $fmtDate — d/m/Y, "—" when empty/invalid.
function fmtDate(dt: string): string {
  const s = String(dt ?? "").trim();
  if (s === "") return "—";
  const ts = Date.parse(s.replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// fmt_money() — number_format($v, 2, ',', '.').
function moneyIt(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}${withThousands},${decPart}`;
}

function buildTerms(termsRaw: string, bizName: string): string[] {
  const norm = String(termsRaw ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = norm === "" ? DEFAULT_TERMS_TPL : norm.split(/\n+/);
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

export function GiftCardVoucherFaithful({ slug, token, embed }: { slug: string; token: string; embed: boolean }) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

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
    fetch(`/api/public/giftcard-voucher?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !data.ok) {
          setError(String(data.error ?? "Voucher GiftCard non trovato."));
          return;
        }
        setVoucher(data.voucher as Voucher);
        setBusiness(data.business as Business);
        setError("");
      })
      .catch(() => {
        if (active) setError("Voucher GiftCard non trovato.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, token]);

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
            {error || "Voucher GiftCard non trovato."}
          </div>
        </div>
      </>
    );
  }

  const meta = statusMeta(voucher.status);
  const initial = voucher.initialAmount;
  const balance = voucher.balance;
  const hasItems = voucher.items.length > 0;
  const hasMoney = initial > 0.00001 || balance > 0.00001;
  const showMoney = hasMoney && !voucher.hideAmount;
  const dest =
    voucher.recipientName !== "" ? voucher.recipientName : voucher.recipientEmail !== "" ? voucher.recipientEmail : "—";
  const terms = buildTerms(business.terms, business.name);

  return (
    <>
      {CSS_LINKS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <div className="voucher-wrap">
        {/* Print toolbar — only when NOT embedded. */}
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
          {meta.watermark !== "" ? <div className="voucher-watermark">{meta.watermark}</div> : null}

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3">
            <div className="d-flex align-items-start gap-3">
              <div>
                <div className="text-muted small">Voucher GiftCard</div>
                <div className="h5 fw-bold mb-0">{business.name}</div>
                {business.addrLine1.trim() !== "" ? <div className="text-muted small">{business.addrLine1}</div> : null}
                {business.addrLine2.trim() !== "" ? <div className="text-muted small">{business.addrLine2}</div> : null}
                {business.addrLine3.trim() !== "" ? <div className="text-muted small">{business.addrLine3}</div> : null}
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
              <div className="mt-2">
                <span className={`badge text-bg-${meta.badge} text-uppercase`}>{meta.label}</span>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="h5 fw-semibold mb-1">GiftCard</div>

              {hasItems && !hasMoney ? (
                <div className="text-muted mb-2">Voucher regalo valido presso {business.name}.</div>
              ) : hasMoney && voucher.hideAmount ? (
                <div className="text-muted mb-2">
                  GiftCard valida presso {business.name}. <strong>Valore non mostrato</strong>: recati in negozio per
                  scoprirlo.
                </div>
              ) : (
                <div className="text-muted mb-2">Credito spendibile presso {business.name}.</div>
              )}

              <div className="row g-2 voucher-meta">
                <div className="col-md-6">
                  <div className="label">Mittente</div>
                  <div className="value">{voucher.clientName !== "" ? voucher.clientName : "—"}</div>
                </div>
                <div className="col-md-6">
                  <div className="label">Destinatario</div>
                  <div className="value">{dest}</div>
                </div>

                {showMoney ? (
                  <>
                    <div className="col-md-4">
                      <div className="label">Valore iniziale</div>
                      <div className="value">€ {moneyIt(initial)}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="label">Saldo residuo</div>
                      <div className="value">€ {moneyIt(balance)}</div>
                    </div>
                  </>
                ) : null}
                <div className="col-md-4">
                  <div className="label">Emessa</div>
                  <div className="value">{fmtDateTime(voucher.issuedAt)}</div>
                </div>

                <div className="col-md-4">
                  <div className="label">Scadenza</div>
                  <div className="value">{voucher.expiresAt.trim() !== "" ? fmtDate(voucher.expiresAt) : "—"}</div>
                </div>
                <div className="col-md-4">
                  <div className="label">Esaurita il</div>
                  <div className="value">{meta.code === "redeemed" ? fmtDateTime(voucher.redeemedAt) : "—"}</div>
                </div>
                <div className="col-md-4">
                  <div className="label">Annullata il</div>
                  <div className="value">{meta.code === "cancelled" ? fmtDateTime(voucher.cancelledAt) : "—"}</div>
                </div>
              </div>

              {hasItems ? (
                <div className="mt-3">
                  <div className="fw-semibold text-dark mb-1">Contenuto regalo</div>
                  <ul className="mb-0">
                    {voucher.items.map((it, idx) => {
                      const label = it.type === "service" ? "Servizio" : "Prodotto";
                      const name = it.name !== "" ? it.name : it.type === "product" ? "Prodotto" : "Servizio";
                      return (
                        <li key={idx}>
                          <strong>{label}:</strong> {name}
                          {it.qty > 1 ? ` × ${it.qty}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {voucher.giftMessage !== "" ? (
                <div className="mt-3">
                  <div className="fw-semibold text-dark mb-1">Messaggio di dedica</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{voucher.giftMessage}</div>
                </div>
              ) : null}

              {voucher.note !== "" ? (
                <div className="mt-3">
                  <div className="fw-semibold text-dark mb-1">Nota per il cliente</div>
                  <div className="giftcard-voucher-note">{voucher.note}</div>
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

export default GiftCardVoucherFaithful;
