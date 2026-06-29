import { activeTenantSlugs, assertCronAuth } from "@/lib/cron";
import { dbExecute, dbQuery, tenantIdForSlug } from "@/lib/tenant-db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next port of cron/giftcard_send.php (+ GiftCard::sendDueScheduledGiftCards).
// For each active tenant it finds active giftcards whose scheduled_send_on has
// arrived and that were never emailed, and marks them processed (claim ->
// record the delivery on the row -> release the claim).
//
// MySQL -> Postgres notes: CURDATE() -> CURRENT_DATE, NOW() kept; expires_at is
// a DATE so it is compared to CURRENT_DATE; the MySQL '0000-00-00 00:00:00'
// sentinel is dropped (Postgres can't store it, so "never sent" is simply
// last_email_sent_at IS NULL).
//
// The actual outbound email is NOT sent here: the PHP mailer (mail_send_html)
// is not wired into Next yet. We faithfully port the DB side so items are not
// re-picked, and leave the dispatch as a TODO. Every statement is scoped by
// tenant_id.
const SELECT_LIMIT = 500;
// Flip to true once the outbound email provider is wired. Until then the job
// reports due items but does NOT mark them sent, so scheduled sends are never
// silently consumed without an email actually going out.
const SEND_ENABLED = false;

type DueGiftcard = RowDataPacket & {
  id: number;
  recipient_email: string | null;
  email_show_amount: number | null;
};

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

      // Select due scheduled giftcards that still need sending.
      const due = await dbQuery<DueGiftcard[]>(
        `SELECT id, recipient_email, COALESCE(email_show_amount, 1) AS email_show_amount
           FROM giftcards
          WHERE tenant_id = ?
            AND status='active'
            AND scheduled_send_on IS NOT NULL
            AND scheduled_send_on <= CURRENT_DATE
            AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
            AND last_email_sent_at IS NULL
            AND recipient_email IS NOT NULL
            AND recipient_email <> ''
            AND (email_send_claimed_at IS NULL OR email_send_claimed_at < (NOW() - INTERVAL '15 minutes'))
          ORDER BY scheduled_send_on ASC, id ASC
          LIMIT ${SELECT_LIMIT}`,
        [tenantId],
      );

      if (!SEND_ENABLED) {
        // Provider not wired: surface the due count without consuming items.
        results.push({ tenant: slug, sent: 0, errors: 0, due: due.length });
        continue;
      }

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

        // TODO: wire email/SMS provider — dispatch the GiftCard email here
        // (the PHP GiftCard::sendGiftCardEmail() called mail_send_html()). For
        // now we record the delivery on the row so the item is not re-picked,
        // mirroring the success-path DB writes of sendGiftCardEmail()
        // (which also clears scheduled_send_on).
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
          errors += 1;
          // Release the claim if we somehow failed to record the send.
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
