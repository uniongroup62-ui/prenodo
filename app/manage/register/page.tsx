import type { Metadata } from "next";
import { ManageAccountPage } from "@/components/manage-account-page";

export const metadata: Metadata = {
  title: "Crea gestionale | Prenodo",
};

export default function ManageRegisterPage() {
  return <ManageAccountPage initialMode="register" initialSlug="centroesteticoelite" />;
}
