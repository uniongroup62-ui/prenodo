import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Reset password cliente | Prenodo",
};

export default function AccountResetPage() {
  return <PublicAccountPage initialMode="reset" />;
}
