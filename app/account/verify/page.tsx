import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Verifica email cliente | Prenodo",
};

export default function AccountVerifyPage() {
  return <PublicAccountPage initialMode="verify" />;
}
