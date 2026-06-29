import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SaasAdminApp } from "@/components/saas-admin-app";
import { currentSaasAdminSession } from "@/lib/saas-admin-auth";

export const metadata: Metadata = {
  title: "SaaS Admin | Prenodo",
};

export default async function AdminPage() {
  const session = await currentSaasAdminSession();
  if (!session) redirect("/admin/login");
  return <SaasAdminApp initialUser={session.user} />;
}
