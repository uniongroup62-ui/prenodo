import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { setManageSessionCookie } from "@/lib/manage-auth";
import { consumeSupportAccessToken } from "@/lib/saas-tenant-manager";

export default async function TenantEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ support_token?: string }>;
}) {
  const { tenantSlug } = await params;
  const { support_token: supportToken } = await searchParams;
  if (supportToken) {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for") ?? "";
    const ip = forwardedFor.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";
    const result = await consumeSupportAccessToken({
      slug: tenantSlug,
      token: supportToken,
      ip,
      userAgent: headerStore.get("user-agent") ?? "",
    });
    if (result.ok) {
      await setManageSessionCookie(result.session);
      redirect(`/${encodeURIComponent(tenantSlug)}/dashboard`);
    }
    redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}&msg=${encodeURIComponent(result.error)}`);
  }
  redirect(`/manage/login?slug=${encodeURIComponent(tenantSlug)}`);
}
