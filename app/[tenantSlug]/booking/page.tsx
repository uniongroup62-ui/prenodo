import type { Metadata } from "next";
import { PublicBookingWizard } from "@/components/public-booking-wizard";

export const metadata: Metadata = {
  title: "Prenotazione online | Prenodo",
};

export default async function TenantBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ location_id?: string; service?: string }>;
}) {
  const { tenantSlug } = await params;
  const { location_id: locationId, service } = await searchParams;

  return <PublicBookingWizard slug={tenantSlug} initialLocationId={locationId} initialService={service} />;
}
