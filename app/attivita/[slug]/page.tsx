import type { Metadata } from "next";
import { MarketplaceDetailFaithful } from "@/components/public/marketplace-detail-faithful";
import { centerBySlug } from "@/lib/demo-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const center = centerBySlug(slug);

  return {
    title: center ? `${center.name} | Prenodo` : "Attivita | Prenodo",
    description: center
      ? `Scheda marketplace e prenotazione online per ${center.name}.`
      : "Scheda marketplace Prenodo.",
  };
}

export default async function AttivitaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MarketplaceDetailFaithful slug={slug} />;
}
