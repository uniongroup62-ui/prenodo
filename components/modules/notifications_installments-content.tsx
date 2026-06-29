"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP installment-notifications page
// (?page=notifications_installments, "Rate in scadenza / scadute").
// The page lists installments already overdue plus those due within the next N
// days (default 7, configurable via the "Impostazioni avviso rate" modal), and
// links to "Gestione Rate". It is fed by the existing DB-backed
// /api/manage/installments route, whose installment plans we flatten and filter.

const DEFAULT_ALERT_DAYS = 7;

type ApiInstallment = {
  id: number;
  dueDate: string;
  amount: number;
  status: string;
  paidAt?: string;
};

type ApiInstallmentPlan = {
  id: number;
  saleId: number;
  clientId: number;
  clientName: string;
  total: number;
  paid: number;
  status: string;
  installments: ApiInstallment[];
  createdAt: string;
};

type DueRow = {
  key: string;
  planId: number;
  installmentId: number;
  clientName: string;
  amount: number;
  dueDate: string;
  overdue: boolean;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10) || "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function NotificationsInstallmentsContent() {
  const slug = tenantSlug();
  const [plans, setPlans] = useState<ApiInstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  // No persistence endpoint for this setting; initialise to the PHP default (7).
  const [alertDays, setAlertDays] = useState(DEFAULT_ALERT_DAYS);
  const [alertDaysInput, setAlertDaysInput] = useState(String(DEFAULT_ALERT_DAYS));

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/installments?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setPlans(Array.isArray(j.plans) ? j.plans : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<DueRow[]>(() => {
    const today = startOfDay(new Date());
    const horizon = today + Math.max(0, alertDays) * 24 * 60 * 60 * 1000;
    const out: DueRow[] = [];
    for (const plan of plans) {
      for (const inst of plan.installments ?? []) {
        const status = String(inst.status ?? "");
        if (status === "paid" || status === "cancelled" || status === "canceled") continue;
        const dueMs = Date.parse(inst.dueDate);
        if (!Number.isFinite(dueMs)) continue;
        const dueDay = startOfDay(new Date(dueMs));
        const overdue = dueDay < today || status === "overdue";
        // Always show overdue; show upcoming only within the alert horizon.
        if (!overdue && dueDay > horizon) continue;
        out.push({
          key: `${plan.id}-${inst.id}`,
          planId: plan.id,
          installmentId: inst.id,
          clientName: plan.clientName || "—",
          amount: Number(inst.amount ?? 0),
          dueDate: inst.dueDate,
          overdue,
        });
      }
    }
    return out.sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
  }, [plans, alertDays]);

  function manageHref(): string {
    return `/${encodeURIComponent(slug)}/index.php?page=installments_manage`;
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/notifications_cards.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Notifiche</div>
          <h1 className="bs-page-title">Rate in scadenza / scadute</h1>
          <div className="bs-page-subtitle">
            Mostra le rate gia scadute e quelle in scadenza nei prossimi {alertDays} giorni. Sede: Sede1.
          </div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex flex-wrap justify-content-end gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              data-bs-toggle="modal"
              data-bs-target="#installmentNotificationSettingsModal"
            >
              <i className="bi bi-gear me-1" />
              Impostazioni
            </button>
            <a className="btn btn-outline-primary btn-sm" href={manageHref()}>
              <i className="bi bi-cash-stack me-1" />
              Apri Gestione Rate
            </a>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-4">
          <div className="fw-semibold">
            {loading ? "Caricamento…" : "Nessuna rata in scadenza o scaduta."}
          </div>
          <div className="text-muted small mt-1">
            Qui vedrai le rate gia scadute e quelle in scadenza nei prossimi {alertDays} giorni.
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className={`card notification-card notification-main ${
                row.overdue ? "notification-main--danger" : "notification-main--warning"
              } p-3`}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-semibold">{row.clientName}</div>
                  <div className="text-muted small">
                    {row.overdue ? "Rata scaduta" : "Rata in scadenza"} - Scadenza: {fmtDate(row.dueDate)}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="fw-semibold">{fmtEur(row.amount)}</div>
                  <a className="btn btn-sm btn-outline-primary" href={manageHref()}>
                    <i className="bi bi-cash-stack me-1" />
                    Apri Gestione Rate
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="modal fade"
        id="installmentNotificationSettingsModal"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <form
            method="post"
            className="modal-content"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number.parseInt(alertDaysInput, 10);
              if (Number.isFinite(parsed)) {
                setAlertDays(Math.min(365, Math.max(0, parsed)));
              }
            }}
          >
            <input type="hidden" name="action" value="save_settings" />
            <div className="modal-header">
              <h2 className="modal-title h5">Impostazioni avviso rate</h2>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <label className="form-label fw-semibold" htmlFor="installment_alert_days">
                Avvisa per le rate in scadenza nei prossimi
              </label>
              <div className="input-group">
                <input
                  className="form-control"
                  id="installment_alert_days"
                  name="installment_alert_days"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  required
                  value={alertDaysInput}
                  onChange={(e) => setAlertDaysInput(e.target.value)}
                />
                <span className="input-group-text">giorni</span>
              </div>
              <div className="form-text">
                Le rate gia scadute vengono sempre mostrate. Imposta 0 per includere solo quelle scadute
                e quelle in scadenza oggi.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annulla
              </button>
              <button className="btn btn-primary" type="submit">
                <i className="bi bi-check2-circle me-1" />
                Salva
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
