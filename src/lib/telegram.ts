import "server-only";
import { createHash } from "node:crypto";
import { query } from "@/lib/db";

// Telegram reminders through the ministry's own bot (created with @BotFather).
//   TELEGRAM_BOT_TOKEN   the bot token from BotFather — required
//
// Telegram only lets a bot message people who pressed "Start" on it, so donors
// connect once (personal link / QR, their @username, or sharing their phone
// number with the bot) and the bot stores their chat id. See
// src/app/api/telegram/webhook/route.ts.

const API = (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/** Secret Telegram echoes back on every webhook call (derived from the token, so no extra setting). */
export function webhookSecret(): string {
  return createHash("sha256").update(`omobeeza-webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`).digest("hex").slice(0, 48);
}

interface TgResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export async function tg<T = unknown>(method: string, body?: Record<string, unknown>): Promise<TgResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    return ((await res.json().catch(() => null)) as TgResult<T> | null) ?? { ok: false, description: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "request failed" };
  }
}

let botCache: { username: string; at: number } | null = null;

/** The bot's @username (cached for an hour), or "" when not configured. */
export async function botUsername(): Promise<string> {
  if (!telegramConfigured()) return "";
  if (botCache && Date.now() - botCache.at < 3_600_000) return botCache.username;
  const me = await tg<{ username: string }>("getMe");
  const username = me.ok && me.result ? me.result.username : "";
  if (username) botCache = { username, at: Date.now() };
  return username;
}

/** t.me link that connects this donor to the bot in one tap. */
export async function connectLink(token: string): Promise<string> {
  const bot = await botUsername();
  return bot ? `https://t.me/${bot}?start=${token}` : "";
}

export interface InlineButton {
  text: string;
  url: string;
}

/**
 * Message a connected donor. Logged in sms_log (channel "telegram"). If the
 * donor blocked the bot, their chat is unlinked so SMS takes over again.
 */
export async function sendTelegram(opts: {
  chatId: string;
  text: string;
  kind: "reminder" | "welcome" | "test" | "manual";
  donorId?: number | null;
  button?: InlineButton | null;
  label?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await tg("sendMessage", {
    chat_id: opts.chatId,
    text: opts.text,
    disable_web_page_preview: true,
    ...(opts.button ? { reply_markup: { inline_keyboard: [[opts.button]] } } : {}),
  });
  const error = res.ok ? "" : (res.description ?? "failed");
  await query(
    "insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error, channel) values ($1, $2, $3, $4, $5, '', $6, 'telegram')",
    [opts.donorId ?? null, opts.label ?? `telegram:${opts.chatId}`, opts.text, opts.kind, res.ok ? "sent" : "failed", error.slice(0, 500)],
  ).catch((err) => console.error("telegram: could not log", err));
  if (!res.ok && opts.donorId && (res.error_code === 403 || /blocked|deactivated|chat not found/i.test(error))) {
    await query("update donors set telegram_chat_id = null where id = $1", [opts.donorId]).catch(() => {});
  }
  return res.ok ? { ok: true } : { ok: false, error: `Telegram: ${error}` };
}
