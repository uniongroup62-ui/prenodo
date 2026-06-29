import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";
import { ManageShell } from "@/components/manage-shell";
import { currentManageSession } from "@/lib/manage-auth";
import { shouldPromptOnboarding } from "@/lib/manage-onboarding";
import { tenantSelect } from "@/lib/tenant-db";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await currentManageSession(tenantSlug);
  if (!session) redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`);
  if (await shouldPromptOnboarding(tenantSlug, session.user.role.toLowerCase() === "admin")) {
    redirect(`/${encodeURIComponent(tenantSlug)}/onboarding`);
  }

  let sedeName: string | undefined;
  try {
    if (session.user.currentLocationId) {
      const rows = await tenantSelect({
        slug: tenantSlug,
        table: "locations",
        columns: "name",
        where: "id = ?",
        params: [session.user.currentLocationId],
        limit: 1,
      });
      sedeName = (rows[0] as { name?: string } | undefined)?.name;
    }
  } catch {
    // best effort; subtitle just omits the sede name
  }

  return (
    <ManageShell slug={tenantSlug} userName={session.user.name} currentPage="dashboard">
      <DashboardContent sedeName={sedeName} />
    </ManageShell>
  );
}
