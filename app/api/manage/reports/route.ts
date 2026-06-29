import { jsonError } from "@/lib/api-utils";
import { listDbClients, listDbProducts, listDbSales, posDbSummary } from "@/lib/db-repositories";
import { currentManageSession } from "@/lib/manage-auth";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";
import { can } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione scaduta o non valida.", 401);
  if (!can(session.user.perms, "reports.view")) return jsonError("Permesso report mancante.", 403);

  try {
    const [summary, sales, clients, products] = await Promise.all([
      posDbSummary(tenantSlug),
      listDbSales({ slug: tenantSlug }),
      listDbClients({ slug: tenantSlug }),
      listDbProducts({ slug: tenantSlug }),
    ]);

    return Response.json({
      ok: true,
      source: "app/pages/reports.php",
      sourceMode: "database",
      kpis: {
        activeSales: summary.saleCount,
        revenue: summary.activeTotal,
        cancelledRevenue: summary.cancelledTotal,
        averageTicket: summary.saleCount > 0 ? Math.round((summary.activeTotal / summary.saleCount) * 100) / 100 : 0,
        clients: clients.length,
        lowStock: products.filter((product) => product.stock <= product.minStock).length,
      },
      paymentTotals: summary.paymentTotals,
      mix: {
        services: summary.serviceTotal,
        products: summary.productTotal,
      },
      latestSales: sales.slice(0, 5),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Errore report.");
  }
}
