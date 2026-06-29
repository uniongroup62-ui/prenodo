import type { Metadata } from "next";
import { PublicMarketplace } from "@/components/public-marketplace";

export const metadata: Metadata = {
  title: "Attivita | Prenodo",
  description: "Marketplace pubblico per cercare centri estetici e prenotare online.",
};

export default function AttivitaPage() {
  return <PublicMarketplace resultsOnly />;
}
