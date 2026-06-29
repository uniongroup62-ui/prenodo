import { activeTenantSlugs, assertCronAuth } from "@/lib/cron";
import { dbExecute, dbQuery, tenantIdForSlug } from "@/lib/tenant-db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next port of cron/giftbox_send.php (+ GiftBox::expireDueInstances /
// GiftBox::sendDueScheduledGiftBoxes). For each active tenant it:
//   1. expires issued instances whose expires_at is in the past;
//   2. finds issued instances whose scheduled_send_on has arrived and that
//      were never emailed, and marks them processed (claim -> record the
//      delivery on the row -> release the claim).
//
// MySQL -> Postgres notes: CURDATE() -> CURRENT_DATE, NOW() kept, and the
// MySQL '0000-00-00 00:00:00' sentinel is dropped (Postgres can't store it, so
// "never sent" is simply last_email_sent_at IS NULL).
//
// The actual outbound email is NOT sent here: the PHP mailer (mail_send_html)
// is not wired into Next yet. We faithfully port the DB side so items are not
// re-picked, and leave the dispatch as a TODO. Every statement is scoped by
// tenant_id.
const SELECT_LIMIT = 500;
// Flip to true once the outbound email provider is wired. Until then the SEND
// step reports due items but does NOT mark them sent (expiry still runs).
const SEND_ENABLED = false;

type DueInstance = RowDataPacket & {
  id: number;
  recipient_email: string | null;
  email_show_details: number | null;
};

export async function GET(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const slugs = await activeTenantSlugs();
    const results: Array<{ tenant: string; sent: number; expired: number; errors: number; due?: number }> = [];
    let total = 0;

    for (const slug of slugs) {
      const tenantId = await tenantIdForSlug(slug);
      if (!tenantId) continue;

      let sent = 0;
      let errors = 0;

      // 1) Expire due issued instances (GiftBox::expireDueInstances()).
      const expiredRes = await dbExecute(
        `UPDATE giftbox_instances
            SET status='expired'
          WHERE tenant_id = ?
            AND status='issued'
            AND expires_at IS NOT NULL
            AND expires_at > '1000-01-01 00:00:00'
            AND expires_at < NOW()`,
        [tenantId],
      );
      const expired = expiredRes.affectedRows;

      // 2) Select due scheduled instances that still need sending.
      const due = await dbQuery<DueInstance[]>(
        `SELECT id, recipient_email, COALESCE(email_show_details, 1) AS email_show_details
           FROM giftbox_instances
          WHERE tenant_id = ?
            AND status='issued'
            AND scheduled_send_on IS NOT NULL
            AND scheduled_send_on <= CURRENT_DATE
            AND (expires_at IS NULL OR expires_at >= NOW())
            AND last_email_sent_at IS NULL
            AND recipient_email IS NOT NULL
            AND recipient_email <> ''
            AND (email_send_claimed_at IS NULL OR email_send_claimed_at < (NOW() - INTERVAL '15 minutes'))
          ORDER BY scheduled_send_on ASC, id ASC
          LIMIT ${SELECT_LIMIT}`,
        [tenantId],
      );

      if (!SEND_ENABLED) {
        // Provider not wired: surface due count, expiry already applied above.
        results.push({ tenant: slug, sent: 0, expired, errors: 0, due: due.length });
        continue;
      }

      for (const row of due) {
        const id = Number(row.id ?? 0);
        const to = String(row.recipient_email ?? "").trim();
        const showDetails = Number(row.email_show_details ?? 1) ? 1 : 0;

        if (id <= 0 || to === "") {
          errors += 1;
          continue;
        }

        // Atomically claim the row so concurrent runs don't double-send it.
        const claim = await dbExecute(
          `UPDATE giftbox_instances
              SET email_send_claimed_at=NOW()
            WHERE tenant_id = ?
              AND id = ?
              AND status='issued'
              AND scheduled_send_on IS NOT NULL
              AND scheduled_send_on <= CURRENT_DATE
              AND (expires_at IS NULL OR expires_at >= NOW())
              AND recipient_email IS NOT NULL
              AND recipient_email <> ''
              AND last_email_sent_at IS NULL
              AND (email_send_claimed_at IS NULL OR email_send_claimed_at < (NOW() - INTERVAL '15 minutes'))`,
          [tenantId, id],
        );
        if (claim.affectedRows <= 0) continue;

        // TODO: wire email/SMS provider — dispatch the GiftBox email here
        // (the PHP GiftBox::sendGiftBoxEmail() called mail_send_html()). For
        // now we record the delivery on the row so the item is not re-picked,
        // mirroring the success-path DB writes of sendGiftBoxEmail().
        const recorded = await dbExecute(
          `UPDATE giftbox_instances
              SET last_email_sent_at=NOW(),
                  last_email_sent_to=?,
                  last_email_hide_details=?,
                  email_send_claimed_at=NULL
            WHERE tenant_id = ?
              AND id = ?`,
          [to, showDetails ? 0 : 1, tenantId, id],
        );
        if (recorded.affectedRows > 0) {
          sent += 1;
        } else {
          errors += 1;
          // Release the claim if we somehow failed to record the send.
          await dbExecute(
            `UPDATE giftbox_instances
                SET email_send_claimed_at=NULL
              WHERE tenant_id = ?
                AND id = ?
                AND last_email_sent_at IS NULL`,
            [tenantId, id],
          );
        }
      }

      results.push({ tenant: slug, sent, expired, errors });
      total += sent;
    }

    return Response.json({ ok: true, job: "giftbox-send", source: "cron/giftbox_send.php", sendEnabled: SEND_ENABLED, total, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore cron giftbox-send." },
      { status: 500 },
    );
  }
}

export const POST = GET;
