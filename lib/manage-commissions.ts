import "server-only";

import type { RowDataPacket } from "@/lib/tenant-db";
import { tenantInsert, tenantSelect, tenantTable, tenantUpdate } from "@/lib/tenant-db";

// Commission SETTINGS + module toggle — faithful port of the Commissions.php settings layer
// (defaultSettings / settingsMap / saveSettings / moduleSettings / setModuleEnabled). The accrual
// engine (buildDashboard) lands in a later block; this module is the config foundation the settings
// tab writes and the engine reads.

export type CommissionCalculationMode = "paid_amount" | "list_price";

export type CommissionStaffSetting = {
  staffId: number;
  name: string;
  email: string;
  isActive: boolean;
  isEnabled: boolean;
  calculationMode: CommissionCalculationMode;
  appointmentPercent: number;
  posProductPercent: number;
  posServicePercent: number;
  posOtherPercent: number;
  notes: string;
};

export type CommissionSettings = {
  moduleEnabled: boolean;
  // Count of operators enabled with at least one rate > 0 (configuredRatesCount) — drives the
  // "configure rates" empty state.
  configuredRates: number;
  staff: CommissionStaffSetting[];
};

// Per-operator rate config coming from the settings form (all fields optional; missing → defaults).
export type CommissionStaffSettingInput = {
  isEnabled?: boolean;
  calculationMode?: string;
  appointmentPercent?: number | string;
  posProductPercent?: number | string;
  posServicePercent?: number | string;
  posOtherPercent?: number | string;
  notes?: string;
};

// normalizeCalculationMode (Commissions.php ~809): only 'list_price' or the default 'paid_amount'.
export function normalizeCommissionCalculationMode(value: unknown): CommissionCalculationMode {
  return String(value ?? "").trim().toLowerCase() === "list_price" ? "list_price" : "paid_amount";
}

// normalizePercent (Commissions.php ~797): clamp to [0, 100], 2 decimals, IT/EN decimal tolerant.
export function normalizeCommissionPercent(value: unknown): number {
  let n = Number(String(value ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) n = 0;
  if (n > 100) n = 100;
  return Math.round(n * 100) / 100;
}

// All commissionable staff (excl. the technical "SSO" row), ordered by name — mirrors
// Commissions::allStaff(includeInactive=true) minus the technical filter.
async function listCommissionStaff(slug: string): Promise<Array<{ id: number; name: string; email: string; isActive: boolean }>> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "staff",
    columns: "id, full_name, email, is_active",
    orderBy: "full_name ASC, id ASC",
  }).catch(() => [] as RowDataPacket[]);
  return rows
    .filter((r) => String(r.full_name ?? "").trim().toUpperCase() !== "SSO")
    .map((r) => ({
      id: Math.max(0, Number(r.id ?? 0) || 0),
      name: String(r.full_name ?? "").trim(),
      email: String(r.email ?? "").trim(),
      isActive: Number(r.is_active ?? 1) === 1,
    }))
    .filter((s) => s.id > 0);
}

// The global module on/off (staff_commission_module_settings.is_enabled, single row).
export async function getCommissionModuleEnabled(slug: string): Promise<boolean> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "staff_commission_module_settings",
    columns: "is_enabled",
    orderBy: "id ASC",
    limit: 1,
  }).catch(() => [] as RowDataPacket[]);
  return Number(rows[0]?.is_enabled ?? 0) === 1;
}

// Full settings snapshot: module toggle + one row per staff (merged with defaults) + the
// configured-rates count (enabled operators with any rate > 0).
export async function getCommissionSettings(slug: string): Promise<CommissionSettings> {
  const [moduleEnabled, staff, settingsRows] = await Promise.all([
    getCommissionModuleEnabled(slug),
    listCommissionStaff(slug),
    tenantSelect<RowDataPacket>({ slug, table: "staff_commission_settings" }).catch(() => [] as RowDataPacket[]),
  ]);
  const byStaff = new Map<number, RowDataPacket>();
  for (const r of settingsRows) byStaff.set(Number(r.staff_id ?? 0), r);

  let configuredRates = 0;
  const staffSettings = staff.map((s): CommissionStaffSetting => {
    const row = byStaff.get(s.id);
    const isEnabled = row ? Number(row.is_enabled ?? 0) === 1 : false;
    const appointmentPercent = normalizeCommissionPercent(row?.appointment_percent);
    const posProductPercent = normalizeCommissionPercent(row?.pos_product_percent);
    const posServicePercent = normalizeCommissionPercent(row?.pos_service_percent);
    const posOtherPercent = normalizeCommissionPercent(row?.pos_other_percent);
    if (isEnabled && (appointmentPercent > 0 || posProductPercent > 0 || posServicePercent > 0 || posOtherPercent > 0)) {
      configuredRates += 1;
    }
    return {
      staffId: s.id,
      name: s.name,
      email: s.email,
      isActive: s.isActive,
      isEnabled,
      calculationMode: normalizeCommissionCalculationMode(row?.calculation_mode),
      appointmentPercent,
      posProductPercent,
      posServicePercent,
      posOtherPercent,
      notes: String(row?.notes ?? ""),
    };
  });

  return { moduleEnabled, configuredRates, staff: staffSettings };
}

// Toggle the global module (staff_commission_module_settings, single row id=1) — faithful to
// setModuleEnabled. Period bookkeeping (staff_commission_module_periods) is handled in the accrual
// block; here we own the is_enabled flag. Returns the refreshed settings.
export async function setCommissionModuleEnabled(slug: string, enabled: boolean, userId: number | null): Promise<CommissionSettings> {
  const table = await tenantTable(slug, "staff_commission_module_settings");
  const rows = await tenantSelect<RowDataPacket>({ slug, table: table.name, columns: "id", orderBy: "id ASC", limit: 1 }).catch(() => [] as RowDataPacket[]);
  if (rows[0]) {
    await tenantUpdate({ slug, table: "staff_commission_module_settings", id: Number(rows[0].id ?? 1), values: { is_enabled: enabled ? 1 : 0, updated_by: userId, updated_at: new Date() } });
  } else {
    await tenantInsert(table, { id: 1, is_enabled: enabled ? 1 : 0, created_by: userId, updated_by: userId });
  }
  return getCommissionSettings(slug);
}

// UPSERT per-operator rates (faithful to saveSettings): only known staff ids, percents clamped,
// calculation_mode normalized, notes capped. Returns the refreshed settings.
export async function saveCommissionSettings(
  slug: string,
  rows: Record<string, CommissionStaffSettingInput>,
  userId: number | null,
): Promise<CommissionSettings> {
  const staff = await listCommissionStaff(slug);
  const validIds = new Set(staff.map((s) => s.id));
  const table = await tenantTable(slug, "staff_commission_settings");
  const existing = await tenantSelect<RowDataPacket>({ slug, table: table.name, columns: "id, staff_id" }).catch(() => [] as RowDataPacket[]);
  const existingByStaff = new Map<number, number>();
  for (const r of existing) existingByStaff.set(Number(r.staff_id ?? 0), Number(r.id ?? 0));

  for (const [key, cfg] of Object.entries(rows ?? {})) {
    const staffId = Math.max(0, Number(key) || 0);
    if (!validIds.has(staffId) || !cfg) continue;
    const values: Record<string, unknown> = {
      staff_id: staffId,
      is_enabled: cfg.isEnabled ? 1 : 0,
      calculation_mode: normalizeCommissionCalculationMode(cfg.calculationMode),
      appointment_percent: normalizeCommissionPercent(cfg.appointmentPercent),
      pos_product_percent: normalizeCommissionPercent(cfg.posProductPercent),
      pos_service_percent: normalizeCommissionPercent(cfg.posServicePercent),
      pos_other_percent: normalizeCommissionPercent(cfg.posOtherPercent),
      notes: String(cfg.notes ?? "").slice(0, 255),
      updated_by: userId,
      updated_at: new Date(),
    };
    const existingId = existingByStaff.get(staffId);
    if (existingId && existingId > 0) {
      await tenantUpdate({ slug, table: "staff_commission_settings", id: existingId, values });
    } else {
      await tenantInsert(table, { ...values, created_by: userId });
    }
  }
  return getCommissionSettings(slug);
}
