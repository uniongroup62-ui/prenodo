import type { Metadata } from "next";
import { AccountForgotFaithful } from "@/components/public/account-forgot-faithful";

export const metadata: Metadata = {
  title: "Recupera password - BeautySuite",
};

export default function AccountForgotPasswordPage() {
  return <AccountForgotFaithful />;
}
