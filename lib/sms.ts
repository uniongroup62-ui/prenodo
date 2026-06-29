import "server-only";

// SMS sending via the OpenAPI SMS gateway (https://sms.openapi.com), a faithful
// port of app/lib/OpenApiSms.php. It is a plain outbound HTTPS call, so it runs
// unchanged on AWS Amplify/Lambda — no PHP needed.
//
// Config (env): OPENAPI_SMS_TOKEN (REQUIRED), OPENAPI_SMS_ENV (sandbox|production,
// default sandbox), OPENAPI_SMS_BASE_URL (optional override), OPENAPI_SMS_SENDER
// (default "Prenodo"), OPENAPI_SMS_ENABLED (default: enabled when a token is set),
// OPENAPI_SMS_CALLBACK_SECRET, OPENAPI_SMS_CALLBACK_URL, OPENAPI_SMS_TIMEOUT.

export type SmsConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  baseUrl: string;
  token: string;
  sender: string;
  callbackSecret: string;
  callbackUrl: string;
  timeout: number;
};

export function smsConfig(): SmsConfig {
  const token = (process.env.OPENAPI_SMS_TOKEN || "").trim();

  let environment = (process.env.OPENAPI_SMS_ENV || "").trim().toLowerCase();
  if (environment !== "sandbox" && environment !== "production") environment = "sandbox";

  let baseUrl = (process.env.OPENAPI_SMS_BASE_URL || "").trim();
  if (baseUrl === "") {
    baseUrl = environment === "production" ? "https://sms.openapi.com" : "https://test.sms.openapi.com";
  }

  const enabledEnv = process.env.OPENAPI_SMS_ENABLED;
  const enabled = enabledEnv !== undefined ? enabledEnv !== "false" && enabledEnv !== "0" : token !== "";

  const timeoutRaw = parseInt(process.env.OPENAPI_SMS_TIMEOUT || "20", 10);
  const timeout = Math.max(3, Math.min(60, Number.isFinite(timeoutRaw) ? timeoutRaw : 20));

  return {
    enabled,
    environment: environment as "sandbox" | "production",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    sender: (process.env.OPENAPI_SMS_SENDER || "Prenodo").trim(),
    callbackSecret: (process.env.OPENAPI_SMS_CALLBACK_SECRET || "").trim(),
    callbackUrl: (process.env.OPENAPI_SMS_CALLBACK_URL || "").trim(),
    timeout,
  };
}

export function smsConfigured(): boolean {
  const c = smsConfig();
  return c.enabled && c.token !== "";
}

// Port of OpenApiSms::normalizeSender — 3..11 alphanumerics, else "".
export function normalizeSmsSender(sender: string | null | undefined): string {
  let s = String(sender ?? "").trim();
  if (s === "") return "";
  s = s.replace(/\s+/g, "");
  return /^[A-Za-z0-9]{3,11}$/.test(s) ? s : "";
}

// Port of OpenApiSms::normalizeRecipient — E.164, IT default.
export function normalizeSmsRecipient(phone: string | null | undefined, defaultCountry = "IT"): string {
  let raw = String(phone ?? "").trim();
  if (raw === "") return "";

  raw = raw.replace(/ /g, "").replace(/ /g, "");
  raw = raw.replace(/[().\-/]/g, "");
  if (raw === "") return "";

  if (raw.startsWith("00")) {
    raw = "+" + raw.slice(2);
  } else if (raw[0] !== "+") {
    const digits = raw.replace(/\D+/g, "");
    if (digits === "") return "";
    raw = defaultCountry.toUpperCase() === "IT" ? "+39" + digits : "+" + digits;
  }

  const normalized = "+" + raw.slice(1).replace(/\D+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return "";
  return normalized;
}

// Port of OpenApiSms::normalizeMessage — strip HTML/entities, collapse ws, 1000 chars.
export function normalizeSmsMessage(message: string): string {
  let s = String(message ?? "");
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  return [...s].slice(0, 1000).join("");
}

export type SendSmsOptions = {
  sender?: string;
  dryRun?: boolean;
  failOnMultipleMessages?: boolean;
  callbackUrl?: string;
  reminderId?: number;
  appointmentId?: number;
  tenant?: string;
};

export type SendSmsResult = {
  ok: boolean;
  statusCode?: number;
  error?: string;
  id?: string;
  state?: string;
  price?: number | null;
  totalPrice?: number | null;
};

function firstNested(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (k in data) return data[k];
  for (const v of Object.values(data)) {
    if (v && typeof v === "object") {
      const found = firstNested(v as Record<string, unknown>, keys);
      if (found != null && found !== "") return found;
    }
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

// Port of OpenApiSms::sendItaly — POST <base>/IT-messages with Bearer token.
export async function sendSmsItaly(
  recipient: string,
  message: string,
  opts: SendSmsOptions = {},
): Promise<SendSmsResult> {
  const cfg = smsConfig();
  if (!cfg.enabled) return { ok: false, error: "Provider SMS OpenAPI disabilitato" };
  if (cfg.token === "") return { ok: false, error: "Token OpenAPI SMS mancante" };

  const to = normalizeSmsRecipient(recipient, "IT");
  if (to === "") return { ok: false, error: "Numero destinatario non valido. Usa formato E.164, es. +393331234567" };

  const text = normalizeSmsMessage(message);
  if (text === "") return { ok: false, error: "Messaggio SMS vuoto" };

  let sender = normalizeSmsSender(opts.sender ?? "");
  if (sender === "") sender = normalizeSmsSender(cfg.sender);

  const body: Record<string, unknown> = {
    recipient: to,
    message: text,
    options: {
      dryRun: Boolean(opts.dryRun),
      failOnMultipleMessages: Boolean(opts.failOnMultipleMessages),
    },
  };
  if (sender !== "") body.sender = sender;

  const callbackUrl = (opts.callbackUrl ?? "").trim();
  if (callbackUrl !== "") {
    const custom: Record<string, string> = {};
    if (opts.reminderId) custom.reminder_id = String(opts.reminderId);
    if (opts.appointmentId) custom.appointment_id = String(opts.appointmentId);
    if (opts.tenant) custom.tenant = String(opts.tenant);
    const callback: Record<string, unknown> = { method: "POST", field: "data", url: callbackUrl, retry: 3 };
    if (Object.keys(custom).length) callback.custom = custom;
    body.callback = callback;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeout * 1000);
  try {
    const res = await fetch(`${cfg.baseUrl}/IT-messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await res.text();
    let decoded: Record<string, unknown> = {};
    if (raw.trim() !== "") {
      try {
        const tmp = JSON.parse(raw);
        if (tmp && typeof tmp === "object") decoded = tmp as Record<string, unknown>;
      } catch {
        /* non-JSON body */
      }
    }
    const code = res.status;
    const ok = code >= 200 && code < 300;
    const id = firstNested(decoded, ["id", "messageId", "message_id", "uuid"]);
    const state = firstNested(decoded, ["state", "status"]);
    return {
      ok,
      statusCode: code,
      error: ok ? "" : String((decoded.message as string) ?? (decoded.error as string) ?? "Errore invio SMS"),
      id: id != null ? String(id) : "",
      state: state != null ? String(state).toUpperCase() : "",
      price: toNum(firstNested(decoded, ["price"])),
      totalPrice: toNum(firstNested(decoded, ["totalPrice", "total_price", "total"])),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Richiesta HTTP SMS fallita" };
  } finally {
    clearTimeout(timer);
  }
}
