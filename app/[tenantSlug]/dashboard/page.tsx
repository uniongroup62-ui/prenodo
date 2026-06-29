import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementApp } from "@/components/management-app";
import { currentManageSession } from "@/lib/manage-auth";
import { shouldPromptOnboarding } from "@/lib/manage-onboarding";

export const metadata: Metadata = {
  title: "Dashboard gestionale | Prenodo",
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
    redirect(`/${encodeURIComponent(tenantSlug)}/index.php?page=onboarding`);
  }

  return <ManagementApp currentUser={session.user} tenantSlug={tenantSlug} />;
}
