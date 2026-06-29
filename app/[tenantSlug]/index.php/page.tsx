import { redirect } from "next/navigation";
import { ManagementApp } from "@/components/management-app";
import { ManageOnboardingApp } from "@/components/manage-onboarding-app";
import { ManageShell } from "@/components/manage-shell";
import { ClientsContent } from "@/components/modules/clients-content";
import { CommissionsContent } from "@/components/modules/commissions-content";
import { CostsContent } from "@/components/modules/costs-content";
import { CouponsContent } from "@/components/modules/coupons-content";
import { LocationsContent } from "@/components/modules/locations-content";
import { PromotionsContent } from "@/components/modules/promotions-content";
import { QuotesContent } from "@/components/modules/quotes-content";
import { RechargesContent } from "@/components/modules/recharges-content";
import { SuppliersContent } from "@/components/modules/suppliers-content";
import { CabinsContent } from "@/components/modules/cabins-content";
import { GiftcardContent } from "@/components/modules/giftcard-content";
import { GiftsContent } from "@/components/modules/gifts-content";
import { HoursContent } from "@/components/modules/hours-content";
import { ProductsContent } from "@/components/modules/products-content";
import { StaffContent } from "@/components/modules/staff-content";
import { ResourcesContent } from "@/components/modules/resources-content";
import { GiftboxContent } from "@/components/modules/giftbox-content";
import { PublicBookingWizard } from "@/components/public-booking-wizard";
import { currentManageSession } from "@/lib/manage-auth";
import { shouldPromptOnboarding } from "@/lib/manage-onboarding";

// Modules already ported to the faithful Path A UI (ManageShell + content).
// Everything else still falls back to the legacy ManagementApp.
const FAITHFUL_MODULES: Record<string, React.ComponentType> = {
  clients: ClientsContent,
  suppliers: SuppliersContent,
  coupons: CouponsContent,
  costs: CostsContent,
  commissions: CommissionsContent,
  quotes: QuotesContent,
  promotions: PromotionsContent,
  locations: LocationsContent,
  recharges: RechargesContent,
  products: ProductsContent,
  cabins: CabinsContent,
  staff: StaffContent,
  hours: HoursContent,
  gifts: GiftsContent,
  giftcard: GiftcardContent,
  resources: ResourcesContent,
  giftbox: GiftboxContent,
};

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

  const FaithfulContent = query.page ? FAITHFUL_MODULES[query.page] : undefined;
  if (FaithfulContent && !query.action && !query.tab) {
    return (
      <ManageShell slug={tenantSlug} userName={session.user.name} currentPage={query.page}>
        <FaithfulContent />
      </ManageShell>
    );
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
