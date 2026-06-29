import type { Metadata } from "next";
import { AccountLoginFaithful } from "@/components/public/account-login-faithful";

export const metadata: Metadata = {
  title: "Accedi al tuo account - BeautySuite",
};

export default function AccountLoginPage() {
  return <AccountLoginFaithful />;
}
