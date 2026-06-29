export async function parseRequestBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const json = await request.json();
      return Object.fromEntries(
        Object.entries(json as Record<string, unknown>).map(([key, value]) => [key, stringifyBodyValue(value)]),
      );
    } catch {
      return {};
    }
  }

  const formData = await request.formData();
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
  );
}

export function emptyToNull(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalized : null;
}

export function parseInteger(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseNumber(value: unknown, fallback = 0): number {
  const normalized = String(value ?? "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function stringifyBodyValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(",");
  if (value === null || value === undefined) return "";
  return String(value);
}
