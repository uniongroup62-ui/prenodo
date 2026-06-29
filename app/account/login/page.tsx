import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Account cliente | Prenodo",
};

export default function AccountLoginPage() {
  return <PublicAccountPage initialMode="login" />;
}
