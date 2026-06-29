import type { Metadata } from "next";
import { ManageAccountPage } from "@/components/manage-account-page";

export const metadata: Metadata = {
  title: "Verifica email | Prenodo",
};

export default async function ManageVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; email?: string; signup_id?: string }>;
}) {
  const { slug, email, signup_id: signupId } = await searchParams;
  return (
    <ManageAccountPage
      initialMode="verify"
      initialSlug={slug || "centroesteticoelite"}
      initialEmail={email || ""}
      initialSignupId={Number.parseInt(signupId || "", 10) || 0}
    />
  );
}
