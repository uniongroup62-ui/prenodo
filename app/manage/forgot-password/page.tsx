import type { Metadata } from "next";
import { ManageAccountPage } from "@/components/manage-account-page";

export const metadata: Metadata = {
  title: "Recupera password | Prenodo",
};

export default async function ManageForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <ManageAccountPage initialMode="forgot-password" initialSlug={slug || "centroesteticoelite"} />;
}
