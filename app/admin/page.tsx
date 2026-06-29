import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardFaithful } from "@/components/admin/admin-dashboard-faithful";
import { currentSaasAdminSession } from "@/lib/saas-admin-auth";

export const metadata: Metadata = {
  title: "Dashboard - SaaS Admin",
};

export default async function AdminPage() {
  const session = await currentSaasAdminSession();
  if (!session) redirect("/admin/login");
  return <AdminDashboardFaithful userEmail={session.user.email} />;
}
