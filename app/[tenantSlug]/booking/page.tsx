import type { Metadata } from "next";
import { BookingFaithful } from "@/components/public/booking-faithful";

export const metadata: Metadata = {
  title: "Prenotazione online - BeautySuite",
};

export default async function TenantBookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <BookingFaithful slug={tenantSlug} />;
}
