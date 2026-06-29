import {
  can,
  canAny,
  landingPageForPermissions,
  manageableRoles,
  normalizeSelectedPerms,
  permissionDefinitions,
  permissionsByGroup,
  isAssignable,
  validateSelectedPerms,
} from "@/lib/role-permissions";
import {
  tenantPrefix,
  tenantSessionSuffix,
} from "@/lib/tenant-runtime";
import { currentManageSession } from "@/lib/manage-auth";
import { getManageLocationContext } from "@/lib/manage-locations";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { columnExists, dbExecute, quoteIdentifier, tenantInsert, tenantSelect, tenantTable } from "@/lib/tenant-db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  const activeUser = session.user;
  const normalizedPerms = normalizeSelectedPerms(activeUser.perms);
  const locationContext = await getManageLocationContext(tenantSlug);
  const url = new URL(request.url);
  const selectedRole = normalizeRole(url.searchParams.get("role") ?? "staff");
  const roles = await roleAssignments(tenantSlug);

  return Response.json({
    ok: true,
    source: "app/lib/Auth.php + app/lib/RolePermissions.php",
    tenant: {
      slug: tenantSlug,
      prefix: tenantPrefix(tenantSlug),
      sessionSuffix: tenantSessionSuffix(tenantSlug),
      sourceMode: locationContext.sourceMode,
      locations: locationContext.locations,
      currentLocationId: locationContext.currentLocationId,
      needsLocationSelection: locationContext.needsLocationSelection,
    },
    user: {
      ...activeUser,
      perms: normalizedPerms,
    },
    rolePermissions: {
      definitions: permissionDefinitions,
      groups: permissionsByGroup(),
      manageableRoles,
      selectedRole,
      assignments: roles,
      selectedPerms: roles[selectedRole] ?? [],
      validationError: validateSelectedPerms(normalizedPerms),
      canUseAppointments: canAny(normalizedPerms, ["appointments.manage", "appointments.quick_booking"]),
      landingPage: landingPageForPermissions(normalizedPerms),
    },
  });
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  const activeUser = session.user;
  if (String(activeUser.role ?? "").toLowerCase() !== "admin" && !can(activeUser.perms, "roles.manage")) {
    return jsonError("Permesso Ruoli richiesto.", 403);
  }

  const body = await parseRequestBody(request);
  const action = String(body.action ?? "save_role_perms");
  if (action !== "save_role_perms" && action !== "save_staff_perms") return jsonError("Azione ruoli non valida.", 400);

  const role = normalizeRole(body.role ?? "staff");
  const selected = normalizeSelectedPerms(parsePerms(body.perms ?? body.permissions ?? "").filter(isAssignable));
  const validationError = validateSelectedPerms(selected);
  if (validationError) return jsonError(validationError, 400);

  try {
    const previous = (await roleAssignments(tenantSlug))[role] ?? [];
    await replaceRolePermissions(tenantSlug, role, selected);
    await auditRoleChange(tenantSlug, {
      role,
      oldPerms: previous,
      newPerms: selected,
      actor: {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
      },
    });
    const assignments = await roleAssignments(tenantSlug);
    return Response.json({
      ok: true,
      source: "app/pages/roles.php",
      role,
      perms: assignments[role] ?? [],
      assignments,
      landingPage: landingPageForPermissions(assignments[role] ?? []),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Impossibile aggiornare i permessi.", 400);
  }
}

async function roleAssignments(slug: string): Promise<Record<string, string[]>> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "role_permissions", columns: "role,perm", orderBy: "role ASC, perm ASC" }).catch(() => []);
  const out: Record<string, string[]> = {};
  for (const role of Object.keys(manageableRoles)) out[role] = [];
  for (const row of rows) {
    const role = normalizeRole(row.role);
    const perm = String(row.perm ?? "").trim();
    if (!perm || !isAssignable(perm)) continue;
    out[role] = out[role] ?? [];
    out[role].push(perm);
  }
  for (const role of Object.keys(out)) out[role] = normalizeSelectedPerms(out[role]);
  return out;
}

async function replaceRolePermissions(slug: string, role: string, perms: string[]): Promise<void> {
  const table = await tenantTable(slug, "role_permissions");
  const clauses = ["role = ?"];
  const params: unknown[] = [role];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  await dbExecute(`DELETE FROM ${quoteIdentifier(table.name)} WHERE ${clauses.join(" AND ")}`, params);
  for (const perm of perms) {
    await tenantInsert(table, { role, perm });
  }
}

async function auditRoleChange(slug: string, input: {
  role: string;
  oldPerms: string[];
  newPerms: string[];
  actor: { id: number; name: string; email: string };
}): Promise<void> {
  const oldPerms = normalizedAuditPerms(input.oldPerms);
  const newPerms = normalizedAuditPerms(input.newPerms);
  if (oldPerms.join("|") === newPerms.join("|")) return;

  try {
    const roleTable = await tenantTable(slug, "role_permissions");
    const table = roleTable.mode === "prefixed"
      ? { ...roleTable, name: roleTable.name.replace(/role_permissions$/, "role_permission_audit_log") }
      : { ...roleTable, name: "role_permission_audit_log" };
    const tenantColumn = table.mode === "shared" ? "`tenant_id` INT(11) NULL DEFAULT NULL," : "";
    const tenantKey = table.mode === "shared" ? "KEY `idx_role_perm_audit_tenant_role` (`tenant_id`,`role`,`created_at`)," : "";
    await dbExecute(
      `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (
        \`id\` INT(11) NOT NULL AUTO_INCREMENT,
        ${tenantColumn}
        \`actor_user_id\` INT(11) NULL DEFAULT NULL,
        \`actor_name\` VARCHAR(190) NULL DEFAULT NULL,
        \`actor_email\` VARCHAR(190) NULL DEFAULT NULL,
        \`role\` VARCHAR(20) NOT NULL,
        \`old_perms\` LONGTEXT NOT NULL,
        \`new_perms\` LONGTEXT NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        ${tenantKey}
        KEY \`idx_role_created\` (\`role\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    );
    await tenantInsert(table, {
      actor_user_id: input.actor.id || null,
      actor_name: input.actor.name || null,
      actor_email: input.actor.email || null,
      role: input.role,
      old_perms: JSON.stringify(oldPerms),
      new_perms: JSON.stringify(newPerms),
    });
  } catch {
    // Audit best-effort, come nel PHP.
  }
}

function normalizeRole(value: unknown): "staff" | "altro" {
  const role = String(value ?? "staff").trim().toLowerCase();
  return role === "altro" ? "altro" : "staff";
}

function parsePerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback to comma-separated payload.
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizedAuditPerms(perms: string[]): string[] {
  return Array.from(new Set(perms.map((perm) => perm.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
