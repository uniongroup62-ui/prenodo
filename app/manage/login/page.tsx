import type { Metadata } from "next";
import { ManageLoginFaithful } from "@/components/manage-login-faithful";

export const metadata: Metadata = {
  title: "Accedi al gestionale - BeautySuite",
};

export default async function ManageLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <ManageLoginFaithful initialSlug={slug || "centroesteticoelite"} />;
}
