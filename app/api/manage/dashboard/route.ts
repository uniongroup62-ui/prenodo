import { jsonError } from "@/lib/api-utils";
import {
  costDbSummary,
  listDbAppointments,
  listDbClients,
  listDbCosts,
  listDbNotifications,
  listDbSales,
} from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";
import type { AppointmentWithMeta } from "@/lib/appointment-engine";
import type { CostItem, NotificationItem, PosSale } from "@/lib/tenant-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  tone?: "good" | "bad" | "neutral";
};

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "dashboard.view")) return jsonError("Permesso dashboard mancante.", 403);

  try {
    const [clients, appointments, sales, costs, notifications, costSummary] = await Promise.all([
      listDbClients({ slug: tenantSlug, includeArchived: false }),
      listDbAppointments({ slug: tenantSlug }),
      listDbSales({ slug: tenantSlug, includeCancelled: true }),
      listDbCosts(tenantSlug),
      listDbNotifications(tenantSlug),
      costDbSummary(tenantSlug),
    ]);

    return Response.json({
      ok: true,
      source: "app/pages/dashboard.php",
      sourceMode: "database",
      ...buildDashboard({
        clients,
        appointments,
        sales,
        costs,
        notifications,
        costSummary,
      }),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore dashboard.");
  }
}

function buildDashboard({
  clients,
  appointments,
  sales,
  costs,
  notifications,
  costSummary,
}: {
  clients: Array<{ createdAt?: string }>;
  appointments: AppointmentWithMeta[];
  sales: PosSale[];
  costs: CostItem[];
  notifications: NotificationItem[];
  costSummary: { open: number; overdue: number; paid: number; dueAmount: number };
}) {
  const today = todayIsoLocal();
  const weekDates = currentWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];
  const last30 = addDays(today, -30);
  const activeSales = sales.filter((sale) => sale.status !== "cancelled");
  const salesLast30 = activeSales.filter((sale) => sale.createdAt.slice(0, 10) >= last30);
  const todayAppointments = appointments
    .filter((appointment) => (appointment.date ?? today) === today)
    .sort((left, right) => left.time.localeCompare(right.time));
  const upcomingAppointments = appointments
    .filter((appointment) => (appointment.date ?? today) >= today && appointment.status !== "Completato")
    .sort((left, right) => `${left.date ?? today} ${left.time}`.localeCompare(`${right.date ?? today} ${right.time}`))
    .slice(0, 8);
  const weeklyAppointments = appointments.filter((appointment) => {
    const date = appointment.date ?? today;
    return date >= weekStart && date <= weekEnd;
  });
  const weeklySales = activeSales.filter((sale) => {
    const date = sale.createdAt.slice(0, 10);
    return date >= weekStart && date <= weekEnd;
  });
  const newClientsThisWeek = clients.filter((client) => {
    const date = (client.createdAt ?? "").slice(0, 10);
    return date >= weekStart && date <= weekEnd;
  }).length;
  const newClientsPreviousWeek = clients.filter((client) => {
    const date = (client.createdAt ?? "").slice(0, 10);
    return date >= addDays(weekStart, -7) && date < weekStart;
  }).length;

  const series = weekDates.map((date) => ({
    date,
    label: date.slice(8, 10) + "/" + date.slice(5, 7),
    revenue: roundMoney(weeklySales.filter((sale) => sale.createdAt.slice(0, 10) === date).reduce((total, sale) => total + sale.total, 0)),
    appointments: weeklyAppointments.filter((appointment) => (appointment.date ?? today) === date).length,
  }));
  const weeklyRevenue = roundMoney(weeklySales.reduce((total, sale) => total + sale.total, 0));
  const revenueLast30 = roundMoney(salesLast30.reduce((total, sale) => total + sale.total, 0));

  return {
    stats: [
      { label: "Clienti", value: String(clients.length), detail: "anagrafiche attive" },
      { label: "Appuntamenti oggi", value: String(todayAppointments.length), detail: "agenda operativa" },
      { label: "Vendite ultimi 30gg", value: formatEuro(revenueLast30), detail: `${salesLast30.length} vendite attive` },
    ] satisfies DashboardMetric[],
    weekly: {
      range: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
      metrics: [
        { label: "Appuntamenti", value: String(weeklyAppointments.length), detail: percentageDetail(weeklyAppointments.length, 0) },
        { label: "Ricavi", value: formatEuro(weeklyRevenue), detail: percentageDetail(weeklyRevenue, 0) },
        { label: "Ore lavorate", value: String(weeklyAppointments.filter((appointment) => appointment.status === "Completato").length), detail: percentageDetail(weeklyAppointments.length, 0) },
        { label: "Nuovi clienti", value: String(newClientsThisWeek), detail: percentageDetail(newClientsThisWeek, newClientsPreviousWeek), tone: newClientsThisWeek >= newClientsPreviousWeek ? "good" : "bad" },
      ] satisfies DashboardMetric[],
      series,
    },
    appointments: {
      today: todayAppointments,
      upcoming: upcomingAppointments,
    },
    notifications: notifications.filter((notification) => !notification.read).slice(0, 5),
    costs: {
      summary: costSummary,
      overdueAmount: roundMoney(costs.filter((cost) => cost.status === "overdue").reduce((total, cost) => total + cost.amount, 0)),
      monthAmount: roundMoney(costs.filter((cost) => cost.dueDate.slice(0, 7) === today.slice(0, 7) && cost.status !== "paid").reduce((total, cost) => total + cost.amount, 0)),
      overdueCount: costs.filter((cost) => cost.status === "overdue").length,
      monthCount: costs.filter((cost) => cost.dueDate.slice(0, 7) === today.slice(0, 7) && cost.status !== "paid").length,
    },
  };
}

function currentWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return dateIsoLocal(date);
  });
}

function todayIsoLocal(): string {
  return dateIsoLocal(new Date());
}

function dateIsoLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return dateIsoLocal(next);
}

function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function formatEuro(value: number): string {
  return `${roundMoney(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} euro`;
}

function percentageDetail(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "+100%";
  const value = Math.round(((current - previous) / previous) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
