import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Registrazione cliente | Prenodo",
};

export default function AccountRegisterPage() {
  return <PublicAccountPage initialMode="register" />;
}
