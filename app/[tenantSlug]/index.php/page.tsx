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
import { WalletContent } from "@/components/modules/wallet-content";
import { InstallmentsManageContent } from "@/components/modules/installments-manage-content";
import { AccessibilityContent } from "@/components/modules/accessibility-content";
import { AutomationContent } from "@/components/modules/automation-content";
import { BookingSettingsContent } from "@/components/modules/booking-content";
import { ConsentModulesContent } from "@/components/modules/consent_modules-content";
import { FidelityContent } from "@/components/modules/fidelity-content";
import { PosHistoryContent } from "@/components/modules/pos_history-content";
import { ReportsContent } from "@/components/modules/reports-content";
import { StockMovesContent } from "@/components/modules/stock_moves-content";
import { BusinessProfileContent } from "@/components/modules/business_profile-content";
import { FidelityPointsContent } from "@/components/modules/fidelity_points-content";
import { FidelityMembershipContent } from "@/components/modules/fidelity_membership-content";
import { PosSettingsContent } from "@/components/modules/pos_settings-content";
import { PosPrepaidsContent } from "@/components/modules/pos_prepaids-content";
import { PosPreordersContent } from "@/components/modules/pos_preorders-content";
import { StaffAvailabilityContent } from "@/components/modules/staff_availability-content";
import { AppointmentsPlanContent } from "@/components/modules/appointments_plan-content";
import { NotificationsContent } from "@/components/modules/notifications-content";
import { NotificationsBirthdaysContent } from "@/components/modules/notifications_birthdays-content";
import { NotificationsInstallmentsContent } from "@/components/modules/notifications_installments-content";
import { NotificationsQuotesContent } from "@/components/modules/notifications_quotes-content";
import { RolesContent } from "@/components/modules/roles-content";
import { GiftcardSettingsContent } from "@/components/modules/giftcard_settings-content";
import { GiftboxSettingsContent } from "@/components/modules/giftbox_settings-content";
import { QuoteSettingsContent } from "@/components/modules/quote_settings-content";
import { ServicesContent } from "@/components/modules/services-content";
import { ServiceCategoriesContent } from "@/components/modules/service_categories-content";
import { ServiceRecommendationsContent } from "@/components/modules/service_recommendations-content";
import { PackagesContent } from "@/components/modules/packages-content";
import { PackageSettingsContent } from "@/components/modules/package_settings-content";
import { MarketplaceSettingsContent } from "@/components/modules/marketplace-content";
import { FidelityWalletContent } from "@/components/modules/fidelity_wallet-content";
import { CreditMovementsContent } from "@/components/modules/credit_movements-content";
import { ClientSheetsContent } from "@/components/modules/client_sheets-content";
import { ClientConsentsContent } from "@/components/modules/client_consents-content";
import { ClientSheetTemplatesContent } from "@/components/modules/client_sheet_templates-content";
import { FidelityLevelsContent } from "@/components/modules/fidelity_levels-content";
import { FidelityMembershipSettingsContent } from "@/components/modules/fidelity_membership_settings-content";
import { PosContent } from "@/components/modules/pos-content";
import { CalendarContent } from "@/components/modules/calendar-content";
import { AppointmentsContent } from "@/components/modules/appointments-content";
import { BookingFaithful } from "@/components/public/booking-faithful";
import { GiftBoxVoucherFaithful } from "@/components/public/giftbox-voucher-faithful";
import { GiftCardVoucherFaithful } from "@/components/public/giftcard-voucher-faithful";
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
  wallet: WalletContent,
  installments_manage: InstallmentsManageContent,
  consent_modules: ConsentModulesContent,
  accessibility: AccessibilityContent,
  automation: AutomationContent,
  reports: ReportsContent,
  stock_moves: StockMovesContent,
  pos_history: PosHistoryContent,
  fidelity: FidelityContent,
  booking: BookingSettingsContent,
  business_profile: BusinessProfileContent,
  fidelity_points: FidelityPointsContent,
  fidelity_membership: FidelityMembershipContent,
  pos_settings: PosSettingsContent,
  pos_prepaids: PosPrepaidsContent,
  pos_preorders: PosPreordersContent,
  staff_availability: StaffAvailabilityContent,
  appointments_plan: AppointmentsPlanContent,
  notifications: NotificationsContent,
  notifications_birthdays: NotificationsBirthdaysContent,
  notifications_installments: NotificationsInstallmentsContent,
  notifications_quotes: NotificationsQuotesContent,
  roles: RolesContent,
  giftcard_settings: GiftcardSettingsContent,
  giftbox_settings: GiftboxSettingsContent,
  quote_settings: QuoteSettingsContent,
  services: ServicesContent,
  service_categories: ServiceCategoriesContent,
  service_recommendations: ServiceRecommendationsContent,
  packages: PackagesContent,
  package_settings: PackageSettingsContent,
  marketplace: MarketplaceSettingsContent,
  fidelity_wallet: FidelityWalletContent,
  credit_movements: CreditMovementsContent,
  client_sheets: ClientSheetsContent,
  client_consents: ClientConsentsContent,
  client_sheet_templates: ClientSheetTemplatesContent,
  fidelity_levels: FidelityLevelsContent,
  fidelity_membership_settings: FidelityMembershipSettingsContent,
  pos: PosContent,
  calendar: CalendarContent,
  appointments: AppointmentsContent,
};

export default async function TenantIndexPhpPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ page?: string; public?: string; location_id?: string; service?: string; tab?: string; action?: string; token?: string; embed?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;

  if (query.page === "booking" && query.public === "1") {
    return <BookingFaithful slug={tenantSlug} />;
  }

  // Public GiftBox/GiftCard voucher viewers (gift email links):
  //   index.php?page=giftbox_voucher&public=1&embed=1&token=<64hex>
  //   index.php?page=giftcard_voucher&public=1&embed=1&token=<64hex>
  // Token-only public access; the faithful component fetches the DB-backed API.
  if (query.page === "giftbox_voucher" && query.public === "1") {
    return <GiftBoxVoucherFaithful slug={tenantSlug} token={query.token ?? ""} embed={query.embed === "1"} />;
  }
  if (query.page === "giftcard_voucher" && query.public === "1") {
    return <GiftCardVoucherFaithful slug={tenantSlug} token={query.token ?? ""} embed={query.embed === "1"} />;
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

  const faithfulPageKey = query.page ? faithfulKey(query.page, query.tab) : "";
  const FaithfulContent = faithfulPageKey ? FAITHFUL_MODULES[faithfulPageKey] : undefined;
  if (FaithfulContent && !query.action) {
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

// Resolve the FAITHFUL_MODULES key for a legacy ?page=&tab= combination.
// Distinguishes tab sub-pages (services/packages) without the section
// collapses that legacyPageToSection applies for the old ManagementApp.
function faithfulKey(page: string, tab?: string): string {
  if (page === "services" && tab === "categories") return "service_categories";
  if (page === "services" && tab === "recommended") return "service_recommendations";
  if (page === "services") return "services";
  if (page === "packages" && tab === "settings") return "package_settings";
  if (page === "packages") return "packages";
  if (page === "costs" && tab === "categories") return "cost_categories";
  return page;
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
