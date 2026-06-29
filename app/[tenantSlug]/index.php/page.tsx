import { redirect } from "next/navigation";
import { ManagementApp } from "@/components/management-app";
import { ManageOnboardingApp } from "@/components/manage-onboarding-app";
import { PublicBookingWizard } from "@/components/public-booking-wizard";
import { currentManageSession } from "@/lib/manage-auth";
import { shouldPromptOnboarding } from "@/lib/manage-onboarding";

export default async function TenantIndexPhpPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ page?: string; public?: string; location_id?: string; service?: string; tab?: string; action?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;

  if (query.page === "booking" && query.public === "1") {
    return <PublicBookingWizard slug={tenantSlug} initialLocationId={query.location_id} initialService={query.service} />;
  }

  const session = await currentManageSession(tenantSlug);
  if (!session) redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`);

  if (query.page === "onboarding") {
    if (session.user.role.toLowerCase() !== "admin") redirect(`/${tenantSlug}/dashboard`);
    return <ManageOnboardingApp tenantSlug={tenantSlug} />;
  }

  if (await shouldPromptOnboarding(tenantSlug, session.user.role.toLowerCase() === "admin")) {
    redirect(`/${encodeURIComponent(tenantSlug)}/index.php?page=onboarding`);
  }

  if (query.page) {
    return <ManagementApp initialSection={legacyPageToSection(query.page, query.tab, query.action)} currentUser={session.user} tenantSlug={tenantSlug} />;
  }

  redirect(`/${tenantSlug}/dashboard`);
}

function legacyPageToSection(page: string, tab?: string, action?: string): string {
  if (page === "services" && tab === "categories") return "service_categories";
  if (page === "services" && tab === "recommended") return "service_recommendations";
  if (page === "products" && action === "categories") return "product_categories";
  if (page === "costs" && tab === "categories") return "cost_categories";
  if (page === "packages" && tab === "settings") return "package_settings";

  const map: Record<string, string> = {
    pos_history: "pos_history",
    pos_prepaids: "pos_prepaids",
    pos_preorders: "pos_preorders",
    pos_settings: "pos_settings",
    rate_management: "installments_manage",
    business_profile: "business_profile",
    consent_modules: "consent_modules",
    staff_availability: "staff_availability",
    appointments_plan: "appointments_plan",
    quote_settings: "quote_settings",
    client_sheets: "client_sheets",
    client_consents: "client_consents",
    client_sheet_templates: "client_sheet_templates",
    stock_moves: "stock_moves",
    credit_movements: "wallet",
    giftbox_settings: "giftbox_settings",
    giftcard_settings: "giftcard_settings",
    fidelity_points: "fidelity_points",
    fidelity_wallet: "wallet",
    fidelity_membership: "fidelity_membership",
    fidelity_membership_settings: "fidelity_membership",
    fidelity_levels: "fidelity_levels",
  };

  return map[page] ?? page;
}
