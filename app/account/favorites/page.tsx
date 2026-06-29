import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Preferiti cliente | Prenodo",
};

export default function AccountFavoritesPage() {
  return <PublicAccountPage initialMode="favorites" />;
}
