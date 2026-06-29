import type { Metadata } from "next";
import { ManageAccountPage } from "@/components/manage-account-page";

export const metadata: Metadata = {
  title: "Reimposta password | Prenodo",
};

export default async function ManageResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; token?: string }>;
}) {
  const { slug, token } = await searchParams;
  return <ManageAccountPage initialMode="reset-password" initialSlug={slug || "centroesteticoelite"} initialToken={token || ""} />;
}
