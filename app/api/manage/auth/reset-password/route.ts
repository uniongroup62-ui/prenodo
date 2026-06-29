import { jsonError, parseRequestBody } from "@/lib/api-utils";
import { resetManagePassword, validateManagePasswordReset } from "@/lib/manage-password-reset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const info = await validateManagePasswordReset(url.searchParams.get("slug") ?? "", url.searchParams.get("token") ?? "");
  if (!info) return jsonError("Link non valido o scaduto.", 404);
  return Response.json({ ok: true, reset: info });
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  const password = String(body.password ?? "");
  const passwordConfirm = String(body.password_confirm ?? body.password2 ?? "");
  if (password !== passwordConfirm) return jsonError("Le password non coincidono.", 400);

  try {
    await resetManagePassword({
      slug: body.slug ?? "",
      token: body.token ?? "",
      password,
    });
    return Response.json({ ok: true, message: "Password aggiornata. Ora puoi accedere." });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Reset password non riuscito.", 400);
  }
}
