import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { currentManageSession } from "@/lib/manage-auth";
import {
  completeManageOnboarding,
  getManageOnboardingState,
  saveManageOnboardingStep,
  skipManageOnboardingStep,
} from "@/lib/manage-onboarding";
import { manageTenantSlugFromRequest } from "@/lib/manage-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);

  try {
    return Response.json(await getManageOnboardingState(tenantSlug));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Onboarding non disponibile.", 400);
  }
}

export async function POST(request: Request) {
  const tenantSlug = manageTenantSlugFromRequest(request);
  const session = await currentManageSession(tenantSlug);
  if (!session) return jsonError("Sessione gestionale scaduta.", 401);
  if (session.user.role.toLowerCase() !== "admin") return jsonError("Solo admin puo configurare l'onboarding.", 403);

  const body = await parseRequestBody(request);
  const action = String(body.action ?? "save_step");
  const step = String(body.step ?? "");

  try {
    if (action === "skip_step") return Response.json(await skipManageOnboardingStep(tenantSlug, step));
    if (action === "complete") return Response.json(await completeManageOnboarding(tenantSlug));
    return Response.json(await saveManageOnboardingStep(tenantSlug, step, body));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Onboarding non aggiornato.", 400);
  }
}

