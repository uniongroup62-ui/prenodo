import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Attivita cliente | Prenodo",
};

export default function AccountActivitiesPage() {
  return <PublicAccountPage initialMode="activities" />;
}
