import { currentSaasAdminSession, isSaasBootstrapped } from "@/lib/saas-admin-auth";

export async function GET() {
  const session = await currentSaasAdminSession();
  return Response.json({
    ok: true,
    bootstrapped: await isSaasBootstrapped(),
    user: session?.user ?? null,
  });
}
