import type { Metadata } from "next";
import { AccountRegisterFaithful } from "@/components/public/account-register-faithful";

export const metadata: Metadata = {
  title: "Crea il tuo account - BeautySuite",
};

export default function AccountRegisterPage() {
  return <AccountRegisterFaithful />;
}
