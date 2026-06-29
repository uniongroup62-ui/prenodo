import type { Metadata } from "next";
import { AccountVerifyFaithful } from "@/components/public/account-verify-faithful";

export const metadata: Metadata = {
  title: "Verifica la tua email - BeautySuite",
};

export default function AccountVerifyPage() {
  return <AccountVerifyFaithful />;
}
