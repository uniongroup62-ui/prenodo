import type { Metadata } from "next";
import { ManageAccountPage } from "@/components/manage-account-page";

export const metadata: Metadata = {
  title: "Accedi al gestionale | Prenodo",
};

export default async function ManageLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <ManageAccountPage initialMode="login" initialSlug={slug || "centroesteticoelite"} />;
}
