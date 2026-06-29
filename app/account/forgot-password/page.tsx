import type { Metadata } from "next";
import { PublicAccountPage } from "@/components/public-account-page";

export const metadata: Metadata = {
  title: "Recupera password cliente | Prenodo",
};

export default function AccountForgotPasswordPage() {
  return <PublicAccountPage initialMode="forgot-password" />;
}
