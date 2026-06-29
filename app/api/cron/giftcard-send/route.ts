import { activeTenantSlugs, assertCronAuth } from "@/lib/cron";
import { buildModernEmailTemplate, emailConfigured, sendEmail } from "@/lib/email";
import { dbExecute, dbQuery, tenantIdForSlug } from "@/lib/tenant-db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next port of cron/giftcard_send.php (+ GiftCard::sendDueScheduledGiftCards).
// For each active tenant it finds active giftcards whose scheduled_send_on has
// arrived and that were never emailed, then for each one: claims the row,
// builds + sends the GiftCard email (faithful port of
// GiftCard::sendGiftCardEmail()), and only on a successful send records the
// delivery on the row (mirroring the PHP success-path DB writes, which also
// clear scheduled_send_on and the claim).
//
// MySQL -> Postgres notes: CURDATE() -> CURRENT_DATE, NOW() kept; expires_at is
// a DATE so it is compared to CURRENT_DATE; the MySQL '0000-00-00 00:00:00'
// sentinel is dropped (Postgres can't store it, so "never sent" is simply
// last_email_sent_at IS NULL).
//
// Outbound email goes through lib/email.ts (Amazon SES). When SES is not
// configured (emailConfigured() === false) the job reports the due count but
// marks nothing, so scheduled sends are never silently consumed without an
// email actually going out. Every statement is scoped by tenant_id.
const SELECT_LIMIT = 500;
// Sending is enabled whenever the email provider (SES) is configured. Until
// then the job reports due items but does NOT mark them sent.
const SEND_ENABLED = emailConfigured();

type DueGiftcard = RowDataPacket & {
  id: number;
  code: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  client_name: string | null;
  gift_message: string | null;
  note: string | null;
  initial_amount: string | number | null;
  status: string | null;
  issued_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  cancelled_at: string | null;
  event_type: string | null;
  voucher_public_token: string | null;
  email_show_amount: number | null;
};

type GiftcardItem = RowDataPacket & {
  giftcard_id: number;
  item_type: string | null;
  item_name: string | null;
  qty: number | null;
};

type BusinessSettings = {
  name: string;
  email: string;
  logoUrl: string;
  giftcardTerms: string;
};

// ---- HTML helpers (ports of the legacy PHP h()/number_format used by the
// GiftCard email body). buildModernEmailTemplate() wraps this branded inner
// HTML; we only escape what we interpolate here, exactly like the PHP did.
function h(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// number_format($v, 2, ',', '.') — Italian money formatting (1.234,56).
function moneyIt(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return `${sign}${withThousands},${decPart}`;
}

function roundMoney(v: number): number {
  const r = Math.round(v * 100) / 100;
  return Math.abs(r) < 0.0000001 ? 0 : r;
}

// date('d/m/Y H:i', ...) — returns "—" when empty/invalid (PHP em dash).
function fmtDateTime(raw: string | null): string {
  const s = String(raw ?? "").trim();
  if (s === "") return "—";
  const ts = Date.parse(s.replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// date('d/m/Y', ...) — returns "—" when empty/invalid.
function fmtDate(raw: string | null): string {
  const s = String(raw ?? "").trim();
  if (s === "") return "—";
  const ts = Date.parse(s.replace(" ", "T"));
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Event subjects, ported from GiftCard::eventMap() (subject column). Only the
// subject differs per event; the body title is fixed ("Hai ricevuto una
// GiftCard!"). Image/emoji from the PHP map are intentionally dropped (the
// event hero image lived under the PHP /assets tree and is not served by Next).
const EVENT_SUBJECTS: Record<string, string> = {
  giftcard: "Hai ricevuto una GiftCard",
  compleanno: "Buon Compleanno! Hai ricevuto una GiftCard",
  anniversario: "Felice Anniversario! Hai ricevuto una GiftCard",
  capodanno: "Buon Anno! Hai ricevuto una GiftCard",
  natale: "Buon Natale! Hai ricevuto una GiftCard",
  epifania: "Buona Epifania! Hai ricevuto una GiftCard",
  san_valentino: "Buon San Valentino! Hai ricevuto una GiftCard",
  festa_donna: "Buona Festa della Donna! Hai ricevuto una GiftCard",
  pasqua: "Buona Pasqua! Hai ricevuto una GiftCard",
  pasquetta: "Buona Pasquetta! Hai ricevuto una GiftCard",
  festa_mamma: "Buona Festa della Mamma! Hai ricevuto una GiftCard",
  festa_papa: "Buona Festa del Papà! Hai ricevuto una GiftCard",
};

function normalizeEventType(v: string | null): string {
  let s = String(v ?? "").trim().toLowerCase();
  s = s.replace(/[ -]/g, "_");
  if (s === "" || !(s in EVENT_SUBJECTS)) return "giftcard";
  return s;
}

// Public voucher URL — port of GiftCard::voucherUrlFromToken(). The legacy app
// derived the base from tenant_base_url()/base_url(); here we read it from env.
// TODO: confirm PRENODO_PUBLIC_BASE_URL is the right base for the tenant's
// public voucher page (the PHP base already included the tenant context).
function voucherUrlFromToken(token: string, slug: string): string {
  const t = String(token ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(t)) return "";
  const base = String(process.env.PRENODO_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (base === "" || !slug) return "";
  return `${base}/${slug}/index.php?page=giftcard_voucher&public=1&embed=1&token=${encodeURIComponent(t)}`;
}

// Per-tenant business branding/settings — legacy used setting_get('name'),
// businesses.email and giftcard_terms. The Next app stores these on the single
// `businesses` row per tenant. logo_path is a /uploads/... path; we make it
// absolute against PRENODO_PUBLIC_BASE_URL so email clients can load it.
async function loadBusinessSettings(tenantId: number): Promise<BusinessSettings> {
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT name, email, logo_path, giftcard_terms
       FROM businesses
      WHERE tenant_id = ?
      ORDER BY id ASC
      LIMIT 1`,
    [tenantId],
  ).catch(() => [] as RowDataPacket[]);
  const row = rows[0] ?? {};

  let name = String(row.name ?? "").trim();
  if (name === "") name = "La mia attività";

  const email = String(row.email ?? "").trim();

  const logoPath = String(row.logo_path ?? "").trim();
  let logoUrl = "";
  if (logoPath !== "") {
    if (/^https?:\/\//i.test(logoPath)) {
      logoUrl = logoPath;
    } else {
      const base = String(process.env.PRENODO_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
      logoUrl = base !== "" ? `${base}${logoPath.startsWith("/") ? "" : "/"}${logoPath}` : "";
    }
  }

  return { name, email, logoUrl, giftcardTerms: String(row.giftcard_terms ?? "") };
}

// Faithful port of the HTML body built by GiftCard::sendGiftCardEmail(). Returns
// { subject, html } where `html` is the inner content passed to
// buildModernEmailTemplate() (which adds the branded wrapper + footer).
function buildGiftcardEmail(
  row: DueGiftcard,
  items: GiftcardItem[],
  showAmount: boolean,
  biz: BusinessSettings,
  slug: string,
): { subject: string; html: string } {
  const bizName = biz.name;
  const to = String(row.recipient_email ?? "").trim();
  const code = String(row.code ?? "");
  const status = String(row.status ?? "active").toLowerCase();

  const initial = roundMoney(Number(row.initial_amount ?? 0));
  const clientName = String(row.client_name ?? "").trim();
  const recipientName = String(row.recipient_name ?? "").trim();

  const eventType = normalizeEventType(row.event_type);

  let msg = String(row.gift_message ?? "").trim();
  if (msg.length > 2000) msg = msg.slice(0, 2000);
  let noteUser = String(row.note ?? "").trim();
  if (noteUser.length > 2000) noteUser = noteUser.slice(0, 2000);

  // Subject (includes the event greeting when set).
  let subject: string;
  if (eventType === "giftcard") {
    subject = `Hai ricevuto una GiftCard - ${bizName}`;
  } else {
    const sub = (EVENT_SUBJECTS[eventType] ?? "Hai ricevuto una GiftCard").trim();
    subject = `${sub} - ${bizName}`;
  }

  let html = "";

  // Greeting / intro.
  let greet = "Ciao";
  if (recipientName !== "") greet += ` ${recipientName}`;
  greet += "!";
  html += `<p style="margin:0 0 10px 0">${h(greet)}</p>`;

  if (clientName !== "") {
    html += `<p style="margin:0 0 12px 0">Hai ricevuto una <strong>GiftCard</strong> da <strong>${h(clientName)}</strong>, valida presso <strong>${h(bizName)}</strong>.</p>`;
  } else {
    html += `<p style="margin:0 0 12px 0">Hai ricevuto una <strong>GiftCard</strong> valida presso <strong>${h(bizName)}</strong>.</p>`;
  }

  // Hero block.
  let amountBadge = "";
  if (showAmount && initial > 0) {
    amountBadge = `€ ${moneyIt(initial)}`;
  }
  html += '<div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;margin:14px 0 18px 0">';
  html += '  <div style="background:#0f766e;color:#ffffff;padding:12px 14px">';
  html += '    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>';
  html += '      <td style="font-size:18px;font-weight:800">Hai ricevuto una GiftCard!</td>';
  if (amountBadge !== "") {
    html += `      <td align="right" style="font-size:18px;font-weight:800;white-space:nowrap">${h(amountBadge)}</td>`;
  }
  html += "    </tr></table>";
  html += "  </div>";
  html += "</div>";
  // NOTE: the PHP hero rendered an event-specific image from the PHP /assets
  // tree (event['image_abs']); that image is not served by the Next app, so the
  // <img> is intentionally omitted here. TODO: re-add if those event images are
  // hosted somewhere reachable.

  // Message (dedica).
  if (msg !== "") {
    html += '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin:0 0 16px 0;background:#ffffff">';
    html += '<div style="font-weight:800;margin-bottom:6px">Messaggio di dedica</div>';
    html += `<div style="white-space:pre-wrap">${h(msg)}</div>`;
    html += "</div>";
  }

  // Nota per il cliente.
  if (noteUser !== "") {
    html += '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin:0 0 16px 0;background:#ffffff">';
    html += '<div style="font-weight:800;margin-bottom:6px">Nota per il cliente</div>';
    html += `<div style="white-space:pre-wrap">${h(noteUser)}</div>`;
    html += "</div>";
  }

  // Details.
  const owner = clientName !== "" ? clientName : "—";
  const recipient = recipientName !== "" ? recipientName : to;
  const detailRow = (label: string, value: string) =>
    "<tr>" +
    `<td style="padding:6px 0;color:#6b7280;font-size:12px">${h(label)}</td>` +
    `<td align="right" style="padding:6px 0;font-weight:600">${h(value)}</td>` +
    "</tr>";

  html += '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin:0 0 16px 0;background:#ffffff">';
  html += '<div style="font-weight:800;margin:0 0 8px 0">Dettagli GiftCard</div>';
  html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">';
  html += detailRow("Mittente", owner);
  html += detailRow("Destinatario", recipient);
  html += detailRow("Emessa", fmtDateTime(row.issued_at));
  html += detailRow("Scadenza", fmtDate(row.expires_at));
  html += detailRow("Esaurita il", status === "redeemed" ? fmtDateTime(row.redeemed_at) : "—");
  html += detailRow("Annullata il", status === "cancelled" ? fmtDateTime(row.cancelled_at) : "—");
  html += "</table>";
  html += "</div>";

  // Gift content (amount/items) honouring email_show_amount.
  if (showAmount) {
    let hasDetails = false;
    if (initial > 0) {
      hasDetails = true;
      html += `<p style="margin:0 0 8px 0"><strong>Valore:</strong> € ${h(moneyIt(initial))}</p>`;
    }
    if (items.length > 0) {
      hasDetails = true;
      html += '<div style="margin:0 0 10px 0"><strong>Contenuto regalo:</strong></div>';
      html += '<ul style="margin:0 0 14px 18px;padding:0">';
      for (const it of items) {
        const t = String(it.item_type ?? "").toLowerCase();
        const label = t === "product" ? "Prodotto" : "Servizio";
        let name = String(it.item_name ?? "").trim();
        const qty = Number(it.qty ?? 1);
        if (name === "") name = label;
        const q = qty > 1 ? ` x${qty}` : "";
        html += `<li>${h(`${label}: ${name}${q}`)}</li>`;
      }
      html += "</ul>";
    }
    if (!hasDetails) {
      html += '<p style="margin:0 0 14px 0">Presenta il codice qui sotto in cassa per utilizzare la GiftCard.</p>';
    }
  } else {
    html += '<p style="margin:0 0 14px 0"><strong>Nota:</strong> per scoprire il valore e/o i servizi/prodotti inclusi, recati in negozio e mostra il codice in cassa.</p>';
  }

  // Redeem code (no QR in email).
  const voucherUrl = voucherUrlFromToken(String(row.voucher_public_token ?? ""), slug);
  html += '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin:0 0 12px 0;background:#ffffff">';
  html += '<div style="color:#6b7280;font-size:12px">Codice di riscatto</div>';
  html += `<div style="font-size:28px;font-weight:600;letter-spacing:1px;margin-top:2px">${h(code)}</div>`;
  html += '<div style="color:#6b7280;font-size:12px;margin-top:6px">MOSTRA QUESTO CODICE IN CASSA</div>';
  html += "</div>";

  if (voucherUrl !== "") {
    html += '<div style="text-align:center;margin:0 0 18px 0">';
    html += `<a href="${h(voucherUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600;letter-spacing:.2px">Vedi Voucher</a>`;
    html += "</div>";
  }

  // Conditions.
  html += '<div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:6px">';
  html += '<div style="font-weight:800;margin:0 0 8px 0">Condizioni</div>';
  let termsRaw = String(biz.giftcardTerms ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  let termsLines: string[];
  if (termsRaw === "") {
    termsLines = [
      "La GiftCard è utilizzabile fino a esaurimento credito e/o fino all'utilizzo dei servizi/prodotti inclusi, oppure fino alla data di scadenza (se presente).",
      "Non convertibile in denaro e non rimborsabile.",
      "Presentare il codice (QR) o il codice alfanumerico in cassa per l'utilizzo.",
      `In caso di smarrimento, contatta ${bizName} indicando il codice GiftCard.`,
    ];
  } else {
    termsLines = termsRaw.split(/\n+/);
  }
  html += '<ul style="margin:0 0 0 18px;padding:0;color:#374151">';
  for (let ln of termsLines) {
    ln = ln.trim();
    if (ln === "") continue;
    ln = ln.replace(/^[-•\t\s]+/u, "");
    ln = ln.replace(/\{\{?BUSINESS_NAME\}?\}|%BUSINESS_NAME%/g, bizName);
    html += `<li>${h(ln)}</li>`;
  }
  html += "</ul>";
  html += "</div>";

  return { subject, html };
}

export async function GET(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const slugs = await activeTenantSlugs();
    const results: Array<{ tenant: string; sent: number; errors: number; due?: number }> = [];
    let total = 0;

    for (const slug of slugs) {
      const tenantId = await tenantIdForSlug(slug);
      if (!tenantId) continue;

      let sent = 0;
      let errors = 0;

      // Select due scheduled giftcards that still need sending, plus everything
      // the email body needs (names, message, amount, code/token, dates).
      const due = await dbQuery<DueGiftcard[]>(
        `SELECT gc.id,
                gc.code,
                gc.recipient_name,
                gc.recipient_email,
                c.full_name AS client_name,
                gc.gift_message,
                gc.note,
                gc.initial_amount,
                gc.status,
                gc.issued_at,
                gc.expires_at,
                gc.redeemed_at,
                gc.cancelled_at,
                gc.event_type,
                gc.voucher_public_token,
                COALESCE(gc.email_show_amount, 1) AS email_show_amount
           FROM giftcards gc
           LEFT JOIN clients c ON c.id = gc.client_id AND c.tenant_id = gc.tenant_id
          WHERE gc.tenant_id = ?
            AND gc.status='active'
            AND gc.scheduled_send_on IS NOT NULL
            AND gc.scheduled_send_on <= CURRENT_DATE
            AND (gc.expires_at IS NULL OR gc.expires_at >= CURRENT_DATE)
            AND gc.last_email_sent_at IS NULL
            AND gc.recipient_email IS NOT NULL
            AND gc.recipient_email <> ''
            AND (gc.email_send_claimed_at IS NULL OR gc.email_send_claimed_at < (NOW() - INTERVAL '15 minutes'))
          ORDER BY gc.scheduled_send_on ASC, gc.id ASC
          LIMIT ${SELECT_LIMIT}`,
        [tenantId],
      );

      if (!SEND_ENABLED) {
        // Provider not configured: surface the due count without consuming items.
        results.push({ tenant: slug, sent: 0, errors: 0, due: due.length });
        continue;
      }

      // Per-tenant business branding/settings (name/email/logo/terms).
      const biz = await loadBusinessSettings(tenantId);

      for (const row of due) {
        const id = Number(row.id ?? 0);
        const to = String(row.recipient_email ?? "").trim();
        const showAmount = Number(row.email_show_amount ?? 1) ? 1 : 0;

        if (id <= 0 || to === "") {
          errors += 1;
          continue;
        }

        // Atomically claim the row so concurrent runs don't double-send it.
        const claim = await dbExecute(
          `UPDATE giftcards
              SET email_send_claimed_at=NOW()
            WHERE tenant_id = ?
              AND id = ?
              AND status='active'
              AND scheduled_send_on IS NOT NULL
              AND scheduled_send_on <= CURRENT_DATE
              AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
              AND recipient_email IS NOT NULL
              AND recipient_email <> ''
              AND last_email_sent_at IS NULL
              AND (email_send_claimed_at IS NULL OR email_send_claimed_at < (NOW() - INTERVAL '15 minutes'))`,
          [tenantId, id],
        );
        if (claim.affectedRows <= 0) continue;

        // Build and send the email; only mark delivered on a successful send.
        let sendOk = false;
        try {
          // Items (services/products) included in the giftcard, scoped by tenant.
          const items = await dbQuery<GiftcardItem[]>(
            `SELECT giftcard_id, item_type, item_name, qty
               FROM giftcard_items
              WHERE tenant_id = ?
                AND giftcard_id = ?
              ORDER BY id ASC`,
            [tenantId, id],
          ).catch(() => [] as GiftcardItem[]);

          const { subject, html } = buildGiftcardEmail(row, items, showAmount === 1, biz, slug);
          const { html: wrappedHtml, text } = buildModernEmailTemplate(subject, html, {
            business_name: biz.name,
            business_email: biz.email,
            business_logo_url: biz.logoUrl,
          });

          const res = await sendEmail({
            to,
            subject,
            html: wrappedHtml,
            text,
            fromName: biz.name,
            replyTo: biz.email || undefined,
          });
          sendOk = res.ok === true;
        } catch {
          sendOk = false;
        }

        if (!sendOk) {
          // Send failed: release the claim and count an error. Do NOT mark sent.
          errors += 1;
          await dbExecute(
            `UPDATE giftcards
                SET email_send_claimed_at=NULL
              WHERE tenant_id = ?
                AND id = ?
                AND last_email_sent_at IS NULL`,
            [tenantId, id],
          );
          continue;
        }

        // Record the delivery on the row, mirroring the success-path DB writes
        // of GiftCard::sendGiftCardEmail() (also clears scheduled_send_on).
        const recorded = await dbExecute(
          `UPDATE giftcards
              SET last_email_sent_at=NOW(),
                  last_email_sent_to=?,
                  last_email_hide_amount=?,
                  scheduled_send_on=NULL,
                  updated_at=NOW(),
                  email_send_claimed_at=NULL
            WHERE tenant_id = ?
              AND id = ?`,
          [to, showAmount ? 0 : 1, tenantId, id],
        );
        if (recorded.affectedRows > 0) {
          sent += 1;
        } else {
          // Email went out but we could not record it; count an error and
          // release the claim so it is not stuck (last_email_sent_at is still
          // NULL, so it may be retried — same risk as the legacy job).
          errors += 1;
          await dbExecute(
            `UPDATE giftcards
                SET email_send_claimed_at=NULL
              WHERE tenant_id = ?
                AND id = ?
                AND last_email_sent_at IS NULL`,
            [tenantId, id],
          );
        }
      }

      results.push({ tenant: slug, sent, errors });
      total += sent;
    }

    return Response.json({ ok: true, job: "giftcard-send", source: "cron/giftcard_send.php", sendEnabled: SEND_ENABLED, total, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore cron giftcard-send." },
      { status: 500 },
    );
  }
}

export const POST = GET;
