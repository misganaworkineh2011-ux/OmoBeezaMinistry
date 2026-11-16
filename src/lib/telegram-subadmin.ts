import "server-only";
import { createHash } from "node:crypto";
import { callBot, type TgResult } from "@/lib/telegram";

// The sub-admin Telegram bot: a second bot (created with @BotFather), for
// sub-admins without an Android phone. They sign in with their phone number
// and password, then register donors in the chat, just like in the
// "Omo Beeza Sub-admin" app. Kept apart from the donor bot so donors never
// see it.
//   TELEGRAM_SUBADMIN_BOT_TOKEN   the second bot's token — required
// The conversation itself is in src/app/api/telegram/subadmin/route.ts.

export const SUBADMIN_WEBHOOK_PATH = "/api/telegram/subadmin";

export function subBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_SUBADMIN_BOT_TOKEN);
}

/** Secret Telegram echoes back on every webhook call (derived from the token). */
export function subBotSecret(): string {
  return createHash("sha256").update(`omobeeza-subadmin-webhook:${process.env.TELEGRAM_SUBADMIN_BOT_TOKEN ?? ""}`).digest("hex").slice(0, 48);
}

export async function subBot<T = unknown>(method: string, body?: Record<string, unknown>): Promise<TgResult<T>> {
  const token = process.env.TELEGRAM_SUBADMIN_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_SUBADMIN_BOT_TOKEN is not set" };
  return callBot<T>(token, method, body);
}

let cache: { username: string; at: number } | null = null;

/** The sub-admin bot's @username (cached for an hour), or "" when not configured. */
export async function subBotUsername(): Promise<string> {
  if (!subBotConfigured()) return "";
  if (cache && Date.now() - cache.at < 3_600_000) return cache.username;
  const me = await subBot<{ username: string }>("getMe");
  const username = me.ok && me.result ? me.result.username : "";
  if (username) cache = { username, at: Date.now() };
  return username;
}
