import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { type ManageSession, setManageSessionCookie } from "@/lib/manage-auth";
import { signupSessionPayload, verifyManageSignupAndProvision } from "@/lib/manage-signup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const signupId = Number.parseInt(body.signup_id ?? "", 10) || 0;

  try {
    const result = await verifyManageSignupAndProvision(signupId, body.email ?? "", body.code ?? "");
    await setManageSessionCookie(signupSessionPayload(result) as ManageSession);
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Verifica non disponibile.", 400);
  }
}

