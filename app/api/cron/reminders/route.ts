import { activeTenantSlugs, assertCronAuth } from "@/lib/cron";
import { dbExecute, dbQuery, tenantIdForSlug } from "@/lib/tenant-db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next port of cron/reminders.php (the biggest legacy cron). Per active tenant it:
//   (a) selects due APPOINTMENT reminders (email + SMS) from `reminders` whose
//       linked appointment is still 'scheduled' and whose client has the right
//       contact, honouring the automation_settings reminder toggles, and would
//       mark them sent;
//   (b) syncs expired fidelity cards to 'inactive', queues FIDELITY card-expiry
//       reminders (renewal-window opening) into `card_reminders`, then selects
//       the due ones and would send them;
//   (c) cleans up old history rows in reminders / card_reminders /
//       communication_logs.
//
// MySQL -> Postgres notes: NOW() kept, CURDATE()/date('Y-m-d') -> CURRENT_DATE,
// DATE_ADD/SUB -> `x + (n * interval '1 day')`. Every statement is scoped by
// `tenant_id = ?` (tenantId from tenantIdForSlug(slug)).
//
// IMPORTANT — outbound dispatch is NOT wired yet. The PHP mailer (mail_send_html
// inside automation_send_email / automation_send_fidelity_expiry_email) and the
// OpenAPI SMS provider (automation_send_sms_reminder / OpenApiSms) are not
// configured in Next. The PHP marks a reminder row 'sent' ONLY AFTER a
// successful provider send. To avoid silently dropping reminders before the
// provider is wired, all "mark sent" writes are gated behind SEND_ENABLED:
// while it is false we only SELECT the due items and surface the would-be
// recipients in the response (results[].dueAppointmentReminders /
// dueAppointmentSmsReminders / dueCardReminders). Bookkeeping that is safe to
// run regardless (toggle-off cleanup, expired-card sync, queueing of new
// card_reminders, and history cleanup) is performed live.
const SELECT_LIMIT = 50;

// Flip to true once the email/SMS provider (mail_send_html + OpenApiSms) is
// wired into Next. Until then we MUST NOT mark reminders as 'sent' (the PHP only
// does so after a real send) or we would lose them.
const SEND_ENABLED = false;

const CLEANUP_DAYS = 30;

type AutomationSettings = RowDataPacket & {
  id: number;
  reminder_enabled: number | null;
  sms_reminder_enabled: number | null;
  fidelity_expiry_reminder_enabled: number | null;
};

type DueAppointmentReminder = RowDataPacket & {
  reminder_id: number;
  appointment_id: number;
  scheduled_at: string;
  status: string | null;
  client_email: string | null;
};

type DueAppointmentSmsReminder = RowDataPacket & {
  reminder_id: number;
  appointment_id: number;
  scheduled_at: string;
  status: string | null;
  client_phone: string | null;
};

type FidelityCardRow = RowDataPacket & {
  id: number;
  client_id: number;
  expires_at: string | null;
  client_email: string | null;
};

type DueCardReminder = RowDataPacket & {
  id: number;
  card_id: number;
  client_id: number;
  card_expires_at: string;
  client_email: string | null;
};

type TenantResult = {
  tenant: string;
  fidCardsExpired: number;
  appointmentReminderEnabled: boolean;
  smsReminderEnabled: boolean;
  fidelityExpiryReminderEnabled: boolean;
  dueAppointmentReminders: Array<{ reminderId: number; appointmentId: number; email: string }>;
  dueAppointmentSmsReminders: Array<{ reminderId: number; appointmentId: number; phone: string }>;
  fidelityQueued: number;
  dueCardReminders: Array<{ id: number; cardId: number; clientId: number; expiresAt: string; email: string }>;
  cleanup: { reminders: number; cardReminders: number; communicationLogs: number };
  sent: number;
};

// PHP appt_norm_status(): normalize an appointment status to its canonical code.
// We only need to know whether it is 'scheduled' (the only status that keeps a
// reminder eligible); everything else is treated as not-scheduled.
function isScheduled(status: string | null): boolean {
  let s = String(status ?? "").trim().toLowerCase();
  if (s === "cancelled") s = "canceled";
  if (["annullato", "annullata", "cancellato", "cancellata", "rifiutato", "rifiutata", "rejected"].includes(s)) {
    s = "canceled";
  }
  return s === "scheduled";
}

// Faithful (minus the deep clamp binary-search) port of
// fidelity_card_renewal_window_config(): reads businesses.fidelity_adhesion_json
// and derives whether the renewal-window reminder is active plus the window
// value/unit. Returns value 0 when the feature is off, which gates the whole
// fidelity queue (PHP: `if (windowCfg.value <= 0) return 0`).
//
// NOTE: the PHP clamps the renewal window so it stays strictly smaller than the
// card validity (fidelity_card_clamp_renewal_window_config, a binary search). We
// keep the configured value as-is here; this only matters once a tenant actually
// stores a renewal window (currently fidelity_adhesion_json is null for live
// tenants, so the feature is off and value is 0). See TODO below.
function renewalWindowConfig(adhesionJson: string | null): { value: number; unit: string } {
  let dec: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(adhesionJson ?? ""));
    if (parsed && typeof parsed === "object") dec = parsed as Record<string, unknown>;
  } catch {
    dec = {};
  }

  const validityValue = normalizeDuration(dec.card_default_validity_value, dec.card_default_validity_unit);
  const expiryEnabled =
    "card_expiry_enabled" in dec ? Boolean(dec.card_expiry_enabled) : validityValue.value > 0;

  const storedEnabled =
    "renewal_enabled" in dec ? Boolean(dec.renewal_enabled) : Number(dec.renewal_window_value ?? 0) > 0;

  const stored = normalizeDuration(dec.renewal_window_value, dec.renewal_window_unit);

  // TODO: port fidelity_card_clamp_renewal_window_config (clamp the window to be
  // strictly smaller than the card validity) if a tenant ever configures one.
  const effectiveEnabled = expiryEnabled && storedEnabled && validityValue.value > 0;
  return {
    value: effectiveEnabled ? stored.value : 0,
    unit: effectiveEnabled ? stored.unit : "days",
  };
}

function normalizeDuration(value: unknown, unit: unknown): { value: number; unit: string } {
  let v = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(v) || v < 0) v = 0;
  if (v > 36500) v = 36500;
  let u = String(unit ?? "days").trim().toLowerCase();
  if (!["days", "months", "years"].includes(u)) u = "days";
  return { value: v, unit: u };
}

// PHP fidelity_card_add_duration_ymd($expiresAt, -window, $unit): the start of
// the renewal window. days -> subtract days; months/years -> subtract whole
// months with day clamping (app_add_months_clamped_ymd).
function subtractDuration(ymd: string, value: number, unit: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (unit === "months" || unit === "years") {
    const months = unit === "years" ? value * 12 : value;
    return addMonthsClamped(y, mo, d, -months);
  }
  // days
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() - value);
  return `${dt.getUTCFullYear().toString().padStart(4, "0")}-${(dt.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${dt.getUTCDate().toString().padStart(2, "0")}`;
}

// PHP app_add_months_clamped_ymd(): add (possibly negative) months, clamping the
// day to the last day of the resulting month.
function addMonthsClamped(y: number, mo: number, d: number, months: number): string {
  let total = y * 12 + (mo - 1) + months;
  if (total < 0) total = 0;
  const ny = Math.floor(total / 12);
  const nmo = (total % 12) + 1;
  const dim = new Date(Date.UTC(ny, nmo, 0)).getUTCDate(); // last day of month
  const nd = Math.min(d, dim);
  return `${ny.toString().padStart(4, "0")}-${nmo.toString().padStart(2, "0")}-${nd
    .toString()
    .padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const slugs = await activeTenantSlugs();
    const results: TenantResult[] = [];
    let total = 0;

    for (const slug of slugs) {
      const tenantId = await tenantIdForSlug(slug);
      if (!tenantId) continue;

      const result: TenantResult = {
        tenant: slug,
        fidCardsExpired: 0,
        appointmentReminderEnabled: false,
        smsReminderEnabled: false,
        fidelityExpiryReminderEnabled: false,
        dueAppointmentReminders: [],
        dueAppointmentSmsReminders: [],
        fidelityQueued: 0,
        dueCardReminders: [],
        cleanup: { reminders: 0, cardReminders: 0, communicationLogs: 0 },
        sent: 0,
      };

      // ----- automation_settings (toggles) -----
      const settingsRows = await dbQuery<AutomationSettings[]>(
        `SELECT id, reminder_enabled, sms_reminder_enabled, fidelity_expiry_reminder_enabled
           FROM automation_settings
          WHERE tenant_id = ?
          ORDER BY id ASC
          LIMIT 1`,
        [tenantId],
      );
      const settings = settingsRows[0];
      // PHP automation_kind_enabled('reminder'/'fidelity...'): a missing column
      // (legacy install) means enabled for reminder; fidelity defaults to off.
      const reminderEnabled = !settings || settings.reminder_enabled == null
        ? true
        : Boolean(settings.reminder_enabled);
      const smsEnabled = Boolean(settings?.sms_reminder_enabled);
      const fidelityEnabled = Boolean(settings?.fidelity_expiry_reminder_enabled);
      result.appointmentReminderEnabled = reminderEnabled;
      result.smsReminderEnabled = smsEnabled;
      result.fidelityExpiryReminderEnabled = fidelityEnabled;

      // ----- expired fidelity cards -> 'inactive' (fidelity_card_sync_expired_statuses) -----
      // Deactivate any card whose expires_at is in the past and that is not
      // already inactive. (PHP also probes alternate columns / releases pending
      // appointment discounts; the live schema uses cards.status + expires_at.)
      const expiredRes = await dbExecute(
        `UPDATE cards
            SET status='inactive'
          WHERE tenant_id = ?
            AND expires_at IS NOT NULL
            AND expires_at < CURRENT_DATE
            AND COALESCE(NULLIF(TRIM(status), ''), 'active') <> 'inactive'`,
        [tenantId],
      );
      result.fidCardsExpired = expiredRes.affectedRows;

      // ----- appointment EMAIL reminders -----
      if (reminderEnabled) {
        const due = await dbQuery<DueAppointmentReminder[]>(
          `SELECT r.id AS reminder_id, r.appointment_id, r.scheduled_at,
                  a.status,
                  c.email AS client_email
             FROM reminders r
             JOIN appointments a ON a.id = r.appointment_id AND a.tenant_id = r.tenant_id
             JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id
            WHERE r.tenant_id = ?
              AND r.channel='email'
              AND r.status='pending'
              AND r.scheduled_at <= NOW()
            ORDER BY r.scheduled_at ASC
            LIMIT ${SELECT_LIMIT}`,
          [tenantId],
        );

        for (const r of due) {
          const reminderId = Number(r.reminder_id ?? 0);
          const appointmentId = Number(r.appointment_id ?? 0);

          // Appointment no longer scheduled -> mark failed (safe bookkeeping).
          if (!isScheduled(r.status)) {
            await dbExecute(
              `UPDATE reminders SET status='failed', last_error=?, sent_at=NULL
                WHERE tenant_id = ? AND id = ?`,
              [`Appuntamento non schedulato (status=${r.status ?? "n/a"})`, tenantId, reminderId],
            );
            continue;
          }
          // Missing client email -> mark failed (safe bookkeeping).
          if (!String(r.client_email ?? "").trim()) {
            await dbExecute(
              `UPDATE reminders SET status='failed', last_error=?, sent_at=NULL
                WHERE tenant_id = ? AND id = ?`,
              ["Email cliente mancante", tenantId, reminderId],
            );
            continue;
          }

          // Reminder is genuinely due to be sent.
          result.dueAppointmentReminders.push({
            reminderId,
            appointmentId,
            email: String(r.client_email).trim(),
          });

          // TODO: wire email/SMS provider (mail_send_html in
          // automation_send_email('reminder', appointmentId)). Only mark sent
          // after a successful send — gated by SEND_ENABLED.
          if (SEND_ENABLED) {
            await dbExecute(
              `UPDATE reminders SET status='sent', sent_at=NOW(), last_error=NULL
                WHERE tenant_id = ? AND id = ?`,
              [tenantId, reminderId],
            );
            result.sent += 1;
          }
        }
      } else {
        // PHP: when the reminder toggle is off, drop pending email reminders.
        await dbExecute(
          `DELETE FROM reminders WHERE tenant_id = ? AND channel='email' AND status='pending'`,
          [tenantId],
        );
      }

      // ----- appointment SMS reminders -----
      if (smsEnabled) {
        const smsDue = await dbQuery<DueAppointmentSmsReminder[]>(
          `SELECT r.id AS reminder_id, r.appointment_id, r.scheduled_at,
                  a.status,
                  c.phone AS client_phone
             FROM reminders r
             JOIN appointments a ON a.id = r.appointment_id AND a.tenant_id = r.tenant_id
             JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id
            WHERE r.tenant_id = ?
              AND r.channel='sms'
              AND r.status='pending'
              AND r.scheduled_at <= NOW()
            ORDER BY r.scheduled_at ASC
            LIMIT ${SELECT_LIMIT}`,
          [tenantId],
        );

        for (const r of smsDue) {
          const reminderId = Number(r.reminder_id ?? 0);
          const appointmentId = Number(r.appointment_id ?? 0);

          if (!isScheduled(r.status)) {
            await dbExecute(
              `UPDATE reminders SET status='failed', last_error=?, sent_at=NULL
                WHERE tenant_id = ? AND id = ?`,
              [`Appuntamento non schedulato (status=${r.status ?? "n/a"})`, tenantId, reminderId],
            );
            continue;
          }
          if (!String(r.client_phone ?? "").trim()) {
            await dbExecute(
              `UPDATE reminders SET status='failed', last_error=?, sent_at=NULL
                WHERE tenant_id = ? AND id = ?`,
              ["Telefono cliente mancante", tenantId, reminderId],
            );
            continue;
          }

          result.dueAppointmentSmsReminders.push({
            reminderId,
            appointmentId,
            phone: String(r.client_phone).trim(),
          });

          // TODO: wire email/SMS provider (OpenApiSms via
          // automation_send_sms_reminder + automation_update_sms_reminder_after_send).
          // Only mark sent after a successful send — gated by SEND_ENABLED.
          if (SEND_ENABLED) {
            await dbExecute(
              `UPDATE reminders SET status='sent', sent_at=NOW(), last_error=NULL
                WHERE tenant_id = ? AND id = ?`,
              [tenantId, reminderId],
            );
            result.sent += 1;
          }
        }
      } else {
        // PHP: when the SMS toggle is off, drop pending SMS reminders.
        await dbExecute(
          `DELETE FROM reminders WHERE tenant_id = ? AND channel='sms' AND status='pending'`,
          [tenantId],
        );
      }

      // ----- queue FIDELITY expiry-window reminders (automation_queue_fidelity_expiry_window_reminders) -----
      if (fidelityEnabled) {
        const bizRows = await dbQuery<RowDataPacket[]>(
          `SELECT fidelity_adhesion_json FROM businesses WHERE tenant_id = ? ORDER BY id ASC LIMIT 1`,
          [tenantId],
        );
        const windowCfg = renewalWindowConfig(
          (bizRows[0]?.fidelity_adhesion_json as string | null) ?? null,
        );

        // PHP: feature only runs when the renewal window value > 0.
        if (windowCfg.value > 0) {
          const cards = await dbQuery<FidelityCardRow[]>(
            `SELECT fc.id, fc.client_id, fc.expires_at, c.email AS client_email
               FROM cards fc
               JOIN clients c ON c.id = fc.client_id AND c.tenant_id = fc.tenant_id
              WHERE fc.tenant_id = ?
                AND fc.expires_at IS NOT NULL
                AND fc.expires_at >= CURRENT_DATE
                AND COALESCE(NULLIF(TRIM(c.email), ''), '') <> ''
                AND fc.status='active'
              ORDER BY fc.expires_at ASC, fc.id ASC`,
            [tenantId],
          );

          const today = todayYmd();
          for (const card of cards) {
            const cardId = Number(card.id ?? 0);
            const clientId = Number(card.client_id ?? 0);
            const expiresAt = normalizeYmd(card.expires_at);
            if (cardId <= 0 || clientId <= 0 || expiresAt === null) continue;

            let windowStart = subtractDuration(expiresAt, Math.abs(windowCfg.value), windowCfg.unit);
            if (windowStart === null) windowStart = expiresAt;

            // PHP: only queue when today is inside [windowStart, expiresAt].
            if (today < windowStart || today > expiresAt) continue;

            // INSERT (the UNIQUE key card_id+reminder_kind+card_expires_at makes
            // re-queues idempotent — ignore the duplicate, matching the PHP
            // try/catch around the insert).
            try {
              const ins = await dbExecute(
                `INSERT INTO card_reminders
                   (tenant_id, card_id, client_id, reminder_kind, card_expires_at, scheduled_at, status, last_error)
                 VALUES (?, ?, ?, 'expiry_window', ?, NOW(), 'pending', NULL)`,
                [tenantId, cardId, clientId, expiresAt],
              );
              if (ins.affectedRows > 0) result.fidelityQueued += 1;
            } catch {
              // Row already present (unique key) — ignore, as the PHP does.
            }
          }
        }
      }

      // ----- select due FIDELITY card reminders (automation_process_fidelity_expiry_reminders) -----
      // Selected regardless of toggle (mirrors PHP, which only gates queueing and
      // the actual send). We never mark these 'sent' unless SEND_ENABLED, since
      // the PHP only marks them after automation_send_fidelity_expiry_email().
      const dueCards = await dbQuery<DueCardReminder[]>(
        `SELECT cr.id, cr.card_id, cr.client_id, cr.card_expires_at,
                c.email AS client_email
           FROM card_reminders cr
           JOIN cards fc ON fc.id = cr.card_id AND fc.tenant_id = cr.tenant_id
           JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
          WHERE cr.tenant_id = ?
            AND cr.reminder_kind='expiry_window'
            AND cr.status='pending'
            AND cr.scheduled_at <= NOW()
          ORDER BY cr.scheduled_at ASC, cr.id ASC
          LIMIT ${SELECT_LIMIT}`,
        [tenantId],
      );

      for (const row of dueCards) {
        const id = Number(row.id ?? 0);
        // Missing client email -> mark failed (safe bookkeeping, mirrors PHP).
        if (!String(row.client_email ?? "").trim()) {
          await dbExecute(
            `UPDATE card_reminders SET status='failed', sent_at=NULL, last_error=?
              WHERE tenant_id = ? AND id = ?`,
            ["Email cliente mancante", tenantId, id],
          );
          continue;
        }

        result.dueCardReminders.push({
          id,
          cardId: Number(row.card_id ?? 0),
          clientId: Number(row.client_id ?? 0),
          expiresAt: String(row.card_expires_at ?? ""),
          email: String(row.client_email).trim(),
        });

        // TODO: wire email/SMS provider (mail_send_html in
        // automation_send_fidelity_expiry_email). Only mark sent after a
        // successful send — gated by SEND_ENABLED.
        if (SEND_ENABLED) {
          await dbExecute(
            `UPDATE card_reminders SET status='sent', sent_at=NOW(), last_error=NULL
              WHERE tenant_id = ? AND id = ?`,
            [tenantId, id],
          );
          result.sent += 1;
        }
      }

      // ----- history cleanup (automation_cleanup_communication_history, 30 days) -----
      // Safe to run regardless of SEND_ENABLED: only removes already terminal rows.
      try {
        const c1 = await dbExecute(
          `DELETE FROM reminders
            WHERE tenant_id = ?
              AND status IN ('sent','failed','skipped')
              AND COALESCE(delivered_at, last_checked_at, sent_at, scheduled_at, updated_at, created_at)
                  < (NOW() - (${CLEANUP_DAYS} * interval '1 day'))`,
          [tenantId],
        );
        result.cleanup.reminders = c1.affectedRows;
      } catch {
        // Cleanup must never block the cron.
      }
      try {
        const c2 = await dbExecute(
          `DELETE FROM card_reminders
            WHERE tenant_id = ?
              AND status IN ('sent','failed')
              AND COALESCE(sent_at, scheduled_at, updated_at, created_at)
                  < (NOW() - (${CLEANUP_DAYS} * interval '1 day'))`,
          [tenantId],
        );
        result.cleanup.cardReminders = c2.affectedRows;
      } catch {
        // Cleanup must never block the cron.
      }
      try {
        const c3 = await dbExecute(
          `DELETE FROM communication_logs
            WHERE tenant_id = ?
              AND status IN ('sent','failed','skipped')
              AND COALESCE(sent_at, created_at)
                  < (NOW() - (${CLEANUP_DAYS} * interval '1 day'))`,
          [tenantId],
        );
        result.cleanup.communicationLogs = c3.affectedRows;
      } catch {
        // Cleanup must never block the cron.
      }

      total += result.sent;
      results.push(result);
    }

    return Response.json({
      ok: true,
      job: "reminders",
      source: "cron/reminders.php",
      sendEnabled: SEND_ENABLED,
      total,
      results,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore cron reminders." },
      { status: 500 },
    );
  }
}

export const POST = GET;

// PHP app_date_sql() / date('Y-m-d') — today's date as a Y-m-d string. Dates in
// this schema are stored/compared as plain Y-m-d strings (mysql2 dateStrings /
// pg parsers return raw strings), so string comparison against expires_at is
// the same lexicographic order PHP relied on.
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

// PHP fidelity_card_normalize_date_ymd(): coerce a stored date to Y-m-d, or null.
function normalizeYmd(raw: string | null): string | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
