import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginFaithful } from "@/components/admin/admin-login-faithful";
import { currentSaasAdminSession } from "@/lib/saas-admin-auth";

export const metadata: Metadata = {
  title: "Login - SaaS Admin",
};

export default async function AdminLoginPage() {
  const session = await currentSaasAdminSession();
  if (session) redirect("/admin");
  return <AdminLoginFaithful />;
}
