import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { resendManageSignupCode } from "@/lib/manage-signup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const signupId = Number.parseInt(body.signup_id ?? "", 10) || 0;

  try {
    const result = await resendManageSignupCode(signupId, body.email ?? "");
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Reinvio codice non disponibile.", 400);
  }
}

