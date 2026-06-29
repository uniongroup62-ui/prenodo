import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Profilo cliente | Prenodo",
};

export default function AccountProfilePage() {
  return <PublicAccountPage initialMode="profile" />;
}
