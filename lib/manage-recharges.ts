import "server-only";

import type { RowDataPacket } from "@/lib/tenant-db";
import { parseInteger } from "@/lib/api-utils";
import { columnExists, tenantDelete, tenantInsert, tenantSelect, tenantTable, tenantUpdate } from "@/lib/tenant-db";
import { getFidelityPointsSettings, listFidelityCampaigns } from "@/lib/db-repositories";

// DB-backed port of the recharge_templates CRUD in app/pages/recharges.php
// (_mode=create_template|update_template|delete_template). These are the
// "Modelli di ricarica" the POS recharge-sale precompiles from. Field set
// mirrors the legacy INSERT/UPDATE: title, base_amount, bonus_kind, bonus_value,
// earn_points, is_active, sort_order.

// Mirror of recharges.php rechargeMoneyMax cap (DECIMAL(10,2) headroom).
const RECHARGE_MONEY_MAX = 99999999.99;

export type RechargeTemplateRow = {
  id: number;
  title: string;
  baseAmount: number;
  bonusKind: "none" | "percent" | "fixed";
  bonusValue: number;
  bonusAmount: number;
  totalAmount: number;
  earnPoints: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type ManageRechargesContext = {
  ok: true;
  sourceMode: "database";
  fidelityEnabled: boolean;
  // Header status (port of the recharges.php $rechargesHeaderActions block):
  // the active fidelity points campaign for today, if any, plus the flat earn step.
  activeCampaignName: string;
  earnStep: number;
  templates: RechargeTemplateRow[];
};

function normalizeBonusKind(value: unknown): "none" | "percent" | "fixed" {
  const kind = String(value ?? "none").toLowerCase();
  return kind === "percent" || kind === "fixed" ? kind : "none";
}

function bonusAmount(base: number, kind: string, value: number): number {
  if (kind === "percent") return roundMoney((base * value) / 100);
  if (kind === "fixed") return roundMoney(value);
  return 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// number_format-tolerant money parse (accepts "1.234,56" / "1234.56" / "100").
function parseMoney(value: unknown): number {
  let raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    raw = raw.replace(",", ".");
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function truthy(value: unknown): boolean {
  return ["1", "true", "yes", "on", "si"].includes(String(value ?? "").toLowerCase());
}

function mapTemplate(row: RowDataPacket): RechargeTemplateRow {
  const baseAmount = roundMoney(Math.max(0, Number(row.base_amount ?? 0) || 0));
  const bonusKind = normalizeBonusKind(row.bonus_kind);
  const bonusValue = roundMoney(Math.max(0, Number(row.bonus_value ?? 0) || 0));
  const bonus = bonusAmount(baseAmount, bonusKind, bonusValue);
  return {
    id: Number(row.id ?? 0) || 0,
    title: String(row.title ?? ""),
    baseAmount,
    bonusKind,
    bonusValue,
    bonusAmount: bonus,
    totalAmount: roundMoney(baseAmount + bonus),
    earnPoints: Number(row.earn_points ?? 1) === 1,
    isActive: Number(row.is_active ?? 1) === 1,
    sortOrder: Number(row.sort_order ?? 0) || 0,
  };
}

// Best-effort fidelity-enabled probe (gates earn_points like $fidGeneralEnabled).
// The fidelity general flag lives on the businesses row; if we cannot read it we
// default to enabled (faithful: the legacy form pre-checks earn_points when on).
async function isFidelityEnabled(slug: string): Promise<boolean> {
  try {
    const rows = await tenantSelect<RowDataPacket>({ slug, table: "businesses", columns: "*", limit: 1 });
    const row = rows[0];
    if (!row) return true;
    for (const key of ["fidelity_enabled", "fidelity_general_enabled", "loyalty_enabled", "points_enabled"]) {
      if (key in row) return Number(row[key] ?? 0) === 1;
    }
    return true;
  } catch {
    return true;
  }
}

export async function getManageRechargesContext(slug: string): Promise<ManageRechargesContext> {
  const [rows, settings, campaigns] = await Promise.all([
    tenantSelect<RowDataPacket>({
      slug,
      table: "recharge_templates",
      columns: "*",
      orderBy: "is_active DESC, sort_order ASC, id DESC",
    }).catch(() => []),
    getFidelityPointsSettings(slug).catch(() => null),
    listFidelityCampaigns(slug).catch(() => []),
  ]);
  const fidelityEnabled = settings ? settings.globalEnabled : await isFidelityEnabled(slug);
  const earnStep = settings && settings.earnStepEuro > 0 ? settings.earnStepEuro : 10;

  // Active fidelity points campaign for today (same rule as the POS campaign earn):
  // active + today within [starts_at, ends_at] (empty bounds = open-ended).
  const today = new Date().toISOString().slice(0, 10);
  const activeCampaign = fidelityEnabled
    ? campaigns.find((c) => c.active && (c.startsAt === "" || c.startsAt <= today) && (c.endsAt === "" || c.endsAt >= today))
    : undefined;

  return {
    ok: true,
    sourceMode: "database",
    fidelityEnabled,
    activeCampaignName: activeCampaign ? activeCampaign.name : "",
    earnStep,
    templates: rows.map(mapTemplate),
  };
}

// Edit-form prefill: one template's editable fields. Port of the legacy modal
// data-* prefill (data-mode=edit).
export async function getManageRechargeTemplate(slug: string, templateId: number): Promise<RechargeTemplateRow | null> {
  if (templateId <= 0) return null;
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "recharge_templates", where: "id=?", params: [templateId], limit: 1 }).catch(() => []);
  if (!rows[0]) return null;
  return mapTemplate(rows[0]);
}

// Port of recharges.php _mode=create_template|update_template. id=0 creates,
// id>0 updates. Validation mirrors the legacy POST (title required, base>0,
// money caps, earn_points gated by fidelity).
export async function saveManageRechargeTemplate(slug: string, body: Record<string, string>): Promise<ManageRechargesContext> {
  const id = parseInteger(body.template_id ?? body.id, 0);

  let existing: RechargeTemplateRow | null = null;
  if (id > 0) {
    existing = await getManageRechargeTemplate(slug, id);
    if (!existing) throw new Error("Modello non trovato.");
  }

  let title = String(body.title ?? "").trim();
  if (title === "") throw new Error("Inserisci un titolo per il modello.");
  if (title.length > 120) title = title.slice(0, 120);

  const baseAmount = parseMoney(body.base_amount);
  if (baseAmount <= 0) throw new Error("Inserisci un importo ricarica valido.");
  if (baseAmount > RECHARGE_MONEY_MAX) throw new Error("Importo ricarica troppo alto.");

  const bonusKind = normalizeBonusKind(body.bonus_kind);
  let bonusValue = parseMoney(body.bonus_value);
  if (bonusValue < 0) bonusValue = 0;
  if (bonusValue > RECHARGE_MONEY_MAX) throw new Error("Valore bonus troppo alto.");
  if (bonusKind === "none") bonusValue = 0;
  const bonus = bonusAmount(baseAmount, bonusKind, bonusValue);
  const total = roundMoney(baseAmount + bonus);
  if (bonus > RECHARGE_MONEY_MAX || total > RECHARGE_MONEY_MAX) throw new Error("Totale credito troppo alto.");

  const fidelityEnabled = await isFidelityEnabled(slug);
  let earnPoints = truthy(body.earn_points) ? 1 : 0;
  if (!fidelityEnabled) {
    // Without fidelity, new templates never earn; existing keep their value.
    earnPoints = id > 0 && existing ? (existing.earnPoints ? 1 : 0) : 0;
  }
  const isActive = truthy(body.is_active) ? 1 : 0;
  let sortOrder = parseInteger(body.sort_order, 0);
  sortOrder = Math.max(-1000000, Math.min(1000000, sortOrder));

  const table = await tenantTable(slug, "recharge_templates");
  const values: Record<string, unknown> = {
    title,
    base_amount: baseAmount,
    bonus_kind: bonusKind,
    bonus_value: bonusValue,
    earn_points: earnPoints,
    is_active: isActive,
  };
  if (await columnExists(table.name, "sort_order")) values.sort_order = sortOrder;

  if (id > 0) {
    await tenantUpdate({ slug, table: "recharge_templates", id, values });
  } else {
    await tenantInsert(table, values);
  }
  return getManageRechargesContext(slug);
}

// Port of recharges.php _mode=delete_template.
export async function deleteManageRechargeTemplate(slug: string, templateId: number): Promise<ManageRechargesContext> {
  if (templateId <= 0) throw new Error("Modello non valido.");
  await tenantDelete({ slug, table: "recharge_templates", id: templateId });
  return getManageRechargesContext(slug);
}
