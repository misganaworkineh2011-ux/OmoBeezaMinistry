import "server-only";
import { query } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// SMS through AfroMessage (https://afromessage.com). Configure in Vercel:
//   AFROMESSAGE_TOKEN          API token (Bearer)          — required
//   AFROMESSAGE_IDENTIFIER_ID  sender identifier ("from")  — optional
//   AFROMESSAGE_SENDER_NAME    approved sender name        — optional
// Every attempt is written to sms_log so the dashboard can show what was sent.

const API = (process.env.AFROMESSAGE_BASE_URL || "https://api.afromessage.com/api").replace(/\/+$/, "");

export type SmsKind = "reminder" | "welcome" | "test" | "manual";

export function smsConfigured(): boolean {
  return Boolean(process.env.AFROMESSAGE_TOKEN);
}

export function smsConfig(): { token: boolean; identifier: boolean; sender: string } {
  return {
    token: Boolean(process.env.AFROMESSAGE_TOKEN),
    identifier: Boolean(process.env.AFROMESSAGE_IDENTIFIER_ID),
    sender: process.env.AFROMESSAGE_SENDER_NAME ?? "",
  };
}

/** The public address of the site, for links inside SMS messages. */
export function publicOrigin(): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return SITE_URL;
}

export async function sendSms(opts: {
  to: string;
  message: string;
  kind: SmsKind;
  donorId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const log = (status: "sent" | "failed", providerId: string, error: string) =>
    query("insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error) values ($1, $2, $3, $4, $5, $6, $7)", [
      opts.donorId ?? null,
      opts.to,
      opts.message,
      opts.kind,
      status,
      providerId,
      error.slice(0, 500),
    ]).catch((err) => console.error("sms: could not log", err));

  const token = process.env.AFROMESSAGE_TOKEN;
  if (!token) {
    await log("failed", "", "AFROMESSAGE_TOKEN is not set");
    return { ok: false, error: "SMS is not configured (AFROMESSAGE_TOKEN is missing)." };
  }

  const post = async (withSender: boolean) => {
    const payload: Record<string, string> = { to: opts.to, message: opts.message };
    if (process.env.AFROMESSAGE_IDENTIFIER_ID) payload.from = process.env.AFROMESSAGE_IDENTIFIER_ID;
    if (withSender && process.env.AFROMESSAGE_SENDER_NAME) payload.sender = process.env.AFROMESSAGE_SENDER_NAME;
    const res = await fetch(`${API}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => null)) as {
      acknowledge?: string;
      response?: { message_id?: string | number; message?: string; errors?: unknown } | string;
    } | null;
    if (res.ok && body?.acknowledge === "success") {
      const id = typeof body.response === "object" && body.response?.message_id ? String(body.response.message_id) : "";
      return { ok: true as const, id };
    }
    const detail =
      typeof body?.response === "string"
        ? body.response
        : JSON.stringify(body?.response?.errors ?? body?.response ?? body ?? `HTTP ${res.status}`);
    return { ok: false as const, detail };
  };

  try {
    let result = await post(true);
    let note = "";
    // A sender name that AfroMessage hasn't approved yet makes every message
    // fail. Send without it (the account's default sender) and say so in the log.
    if (!result.ok && process.env.AFROMESSAGE_SENDER_NAME && /sender id\/name|identifier/i.test(result.detail)) {
      const retry = await post(false);
      if (retry.ok || !/sender id\/name|identifier/i.test(retry.detail)) {
        note = `Sender name "${process.env.AFROMESSAGE_SENDER_NAME}" is not approved by AfroMessage yet, so the default sender was used.`;
        result = retry;
      }
    }
    if (result.ok) {
      await log("sent", result.id, note);
      return { ok: true };
    }
    const detail = note ? `${result.detail} (${note})` : result.detail;
    await log("failed", "", detail);
    return { ok: false, error: `AfroMessage: ${detail}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    await log("failed", "", message);
    return { ok: false, error: `AfroMessage: ${message}` };
  }
}
