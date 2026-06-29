import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManageOnboardingApp } from "@/components/manage-onboarding-app";
import { currentManageSession } from "@/lib/manage-auth";

export const metadata: Metadata = {
  title: "Onboarding gestionale | Prenodo",
};

export default async function TenantOnboardingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await currentManageSession(tenantSlug);
  if (!session) redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`);
  if (session.user.role.toLowerCase() !== "admin") redirect(`/${tenantSlug}/dashboard`);

  return <ManageOnboardingApp tenantSlug={tenantSlug} />;
}

