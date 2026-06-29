import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SaasAdminLoginPage } from "@/components/saas-admin-app";
import { currentSaasAdminSession, isSaasBootstrapped } from "@/lib/saas-admin-auth";

export const metadata: Metadata = {
  title: "Accesso SaaS Admin | Prenodo",
};

export default async function AdminLoginPage() {
  const session = await currentSaasAdminSession();
  if (session) redirect("/admin");
  return <SaasAdminLoginPage initialBootstrapped={await isSaasBootstrapped()} />;
}
