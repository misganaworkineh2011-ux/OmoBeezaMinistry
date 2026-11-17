import "server-only";
import { query, queryOne } from "@/lib/db";
import type { Frequency } from "@/lib/giving";
import { subBot } from "@/lib/telegram-subadmin";

// Shared pieces of the team Telegram bot (route.ts: sign-in, sub-admins and
// registering donors; admin.ts: the admin tools).

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}
export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
}
export interface TgCallback {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number; type: string } };
}

export type Lang = "en" | "am";

/** Who is signed in to this chat: a sub-admin (registrar) or an admin (dashboard user). */
export type Actor =
  | { role: "sub"; id: number; name: string; target: number; lang: Lang }
  | { role: "admin"; id: number; name: string; lang: Lang };

export type Step =
  // Signing in
  | "password"
  | "a_email"
  | "a_password"
  // Registering a donor
  | "name"
  | "phone"
  | "freq"
  | "amount"
  | "amount_custom"
  | "day"
  | "mday"
  | "lang"
  | "email"
  | "confirm"
  // Sub-admin: raise own target
  | "extend"
  // Admin tools
  | "a_find"
  | "a_pay"
  | "a_ext"
  | "a_sub_name"
  | "a_sub_phone"
  | "a_sub_pass"
  | "a_sub_target";

export interface Data {
  /** Signing in: the sub-admin / admin whose password we're waiting for. */
  rid?: number;
  uid?: number;
  ui?: Lang;
  // A donor being registered
  name?: string;
  phone?: string;
  frequency?: Frequency;
  amount?: number;
  day?: number;
  monthDay?: number;
  locale?: Lang;
  email?: string;
  // Admin tools
  did?: number;
  sid?: number;
  subName?: string;
  subPhone?: string;
  subHash?: string;
}

export const birr = (n: number) => n.toLocaleString("en-US");
export const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export async function reply(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await subBot("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
}

export const inline = (rows: { text: string; data?: string; url?: string }[][]) => ({
  reply_markup: {
    inline_keyboard: rows.map((r) => r.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))),
  },
});

export const noKeyboard = { reply_markup: { remove_keyboard: true } };

export async function getSession(chatId: number): Promise<{ step: Step; data: Data } | null> {
  const row = await queryOne<{ step: Step; data: Data; updated_at: string }>(
    "select step, data, updated_at from registrar_bot_sessions where chat_id = $1",
    [String(chatId)],
  );
  if (!row || Date.now() - new Date(row.updated_at).getTime() > 86_400_000) return null;
  return { step: row.step, data: row.data ?? {} };
}

export async function setSession(chatId: number, step: Step, data: Data): Promise<void> {
  await query(
    `insert into registrar_bot_sessions (chat_id, step, data, updated_at) values ($1, $2, $3, now())
     on conflict (chat_id) do update set step = excluded.step, data = excluded.data, updated_at = now()`,
    [String(chatId), step, JSON.stringify(data)],
  );
}

export async function endSession(chatId: number): Promise<void> {
  await query("delete from registrar_bot_sessions where chat_id = $1", [String(chatId)]);
}
