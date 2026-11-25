"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { readGivingNow } from "@/lib/data/giving";
import {
  DEFAULT_GIVING,
  DONOR_STATUSES,
  TEMPLATE_KEYS,
  isEmail,
  normalizePhone,
  normalizeTelegram,
  asFrequency,
  type DonorStatus,
  type Frequency,
  type GivingSettings,
  type TemplateKey,
} from "@/lib/giving";
import { donorMessage, emailDonor, giveButton, runReminders, type DonorForSms, type ReminderRun } from "@/lib/reminders";
import { botUsername, sendTelegram, telegramConfigured, tg, webhookSecret } from "@/lib/telegram";
import { accountConfigured, accountInfo } from "@/lib/telegram-user";
import { SUBADMIN_WEBHOOK_PATH, subBot, subBotConfigured, subBotSecret, subBotUsername } from "@/lib/telegram-subadmin";
import { closeEmail, emailConfigured, sendEmail } from "@/lib/email";
import { saveDonorRecord, type DonorInput } from "@/lib/donor-save";

type Result = { ok: boolean; error?: string; id?: number };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const done = () => revalidatePath("/admin", "layout");

export type { DonorInput } from "@/lib/donor-save";

export async function saveDonor(input: DonorInput): Promise<Result> {
  await requireUser();
  const res = await saveDonorRecord(input);
  if (res.ok) done();
  return res;
}

// Recycle bin: "deleting" a donor moves them to the bin (no reminders, hidden
// everywhere, history kept). From the bin they can be restored or deleted for
// good; the daily cron empties anything older than BIN_DAYS.

const cleanIds = (ids: unknown): number[] =>
  Array.isArray(ids) ? [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000) : [];

export async function moveDonorsToBin(ids: number[]): Promise<Result & { count?: number }> {
  await requireUser();
  const list = cleanIds(ids);
  if (!list.length) return { ok: false, error: "Select at least one donor." };
  const rows = await query("update donors set deleted_at = now() where id = any($1::int[]) and deleted_at is null returning id", [list]);
  done();
  return { ok: true, count: rows.length };
}

export async function restoreDonors(ids: number[]): Promise<Result & { count?: number }> {
  await requireUser();
  const list = cleanIds(ids);
  if (!list.length) return { ok: false, error: "Select at least one donor." };
  // A phone number may have been registered again while this donor was in the bin.
  const rows = await query(
    `update donors d set deleted_at = null
     where d.id = any($1::int[]) and d.deleted_at is not null
       and (d.phone = '' or not exists (select 1 from donors o where o.phone = d.phone and o.id <> d.id and o.deleted_at is null))
     returning d.id`,
    [list],
  );
  done();
  const skipped = list.length - rows.length;
  return skipped > 0 && rows.length === 0
    ? { ok: false, error: "Not restored: another donor already has this phone number." }
    : { ok: true, count: rows.length, error: skipped > 0 ? `${skipped} not restored: another donor already has their phone number.` : undefined };
}

/** Deletes donors (and their payments and message log) for good: only ones already in the bin. */
export async function deleteDonorsForever(ids: number[]): Promise<Result & { count?: number }> {
  await requireUser();
  const list = cleanIds(ids);
  if (!list.length) return { ok: false, error: "Select at least one donor." };
  const rows = await query("delete from donors where id = any($1::int[]) and deleted_at is not null returning id", [list]);
  done();
  return { ok: true, count: rows.length };
}

export async function emptyRecycleBin(): Promise<Result & { count?: number }> {
  await requireUser();
  const rows = await query("delete from donors where deleted_at is not null returning id");
  done();
  return { ok: true, count: rows.length };
}

export async function recordPayment(donorId: number, amount: number, paidOn: string, reference: string, note: string): Promise<Result> {
  const user = await requireUser();
  const value = Math.round(Number(amount));
  if (!(value > 0)) return { ok: false, error: "Enter the amount received." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { ok: false, error: "Choose the date it was received." };
  await query("insert into donor_payments (donor_id, amount, paid_on, reference, note, created_by) values ($1, $2, $3, $4, $5, $6)", [
    donorId,
    value,
    paidOn,
    s(reference, 120),
    s(note, 500),
    user.name,
  ]);
  done();
  return { ok: true };
}

export async function deletePayment(id: number): Promise<void> {
  await requireUser();
  await query("delete from donor_payments where id = $1", [id]);
  done();
}

/** Email a donor now: their reminder, or a custom message. */
export async function emailDonorNow(donorId: number, subject: string, custom: string): Promise<Result> {
  await requireUser();
  const donor = await queryOne<DonorForSms & { email: string; deleted_at: string | null }>(
    "select id, name, nickname, phone, email, amount, reminder_day, frequency, month_day, locale, token, deleted_at from donors where id = $1",
    [donorId],
  );
  if (!donor) return { ok: false, error: "Donor not found." };
  if (donor.deleted_at) return { ok: false, error: "This donor is in the recycle bin. Restore them first." };
  if (!donor.email) return { ok: false, error: "This donor has no email address. Add one above, or send an SMS from the app." };
  const giving = await readGivingNow();
  const text = s(custom, 5000);
  const res = text
    ? await sendEmail({ to: donor.email, subject: s(subject, 200) || "A message from Omo Beeza Ministry", text, kind: "manual", donorId })
    : await emailDonor("reminder", donor, giving);
  closeEmail();
  if (res.ok && !text) await query("update donors set last_reminded_at = now() where id = $1", [donorId]);
  done();
  return res;
}

// ---------------------------------------------------------------- Settings

const saveSettings = async (data: GivingSettings) => {
  await query("insert into settings (key, data) values ('giving', $1) on conflict (key) do update set data = excluded.data, updated_at = now()", [
    JSON.stringify(data),
  ]);
  refresh("settings");
};

export async function saveGiving(input: GivingSettings): Promise<Result> {
  await requireUser();
  const url = s(input.yebunaUrl, 300);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) return { ok: false, error: "The Ye-Buna link must start with https://" };
  const amounts = [...new Set((input.amounts ?? []).map((n) => Math.round(Number(n))).filter((n) => n > 0))].sort((a, b) => a - b).slice(0, 12);
  if (amounts.length === 0) return { ok: false, error: "Add at least one suggested amount." };
  const amountLinks: Record<string, string> = {};
  for (const [amount, link] of Object.entries(input.amountLinks ?? {})) {
    const value = s(link, 300);
    if (!value) continue;
    if (!/^https:\/\/[^\s]+$/.test(value)) return { ok: false, error: `The Ye-Buna link for ${amount} birr must start with https://` };
    if (Number(amount) > 0) amountLinks[String(Math.round(Number(amount)))] = value;
  }
  // The message templates are saved on their own page; keep them as they are.
  await saveSettings({
    ...(await readGivingNow()),
    yebunaUrl: url,
    amounts,
    amountLinks,
    minAmount: Math.max(1, Math.round(Number(input.minAmount)) || DEFAULT_GIVING.minAmount),
    defaultDay: Math.min(6, Math.max(0, Math.round(Number(input.defaultDay)) || 0)),
    defaultFrequency: asFrequency(input.defaultFrequency),
    defaultMonthDay: Math.min(28, Math.max(1, Math.round(Number(input.defaultMonthDay)) || 1)),
    remindersEnabled: Boolean(input.remindersEnabled),
    welcomeEnabled: Boolean(input.welcomeEnabled),
    skipIfPaid: Boolean(input.skipIfPaid),
    telegramEnabled: Boolean(input.telegramEnabled),
    telegramReplacesSms: Boolean(input.telegramReplacesSms),
    telegramUserEnabled: Boolean(input.telegramUserEnabled),
  });
  return { ok: true };
}

/** Dashboard → Message templates. Empty fields go back to the default text. */
export async function saveTemplates(input: Record<TemplateKey, string>, includeStopLink: boolean): Promise<Result> {
  await requireUser();
  const data = { ...(await readGivingNow()), includeStopLink: Boolean(includeStopLink) };
  for (const key of TEMPLATE_KEYS) {
    const max = key.includes("Subject") ? 200 : key.startsWith("email") ? 5000 : 900;
    data[key] = s(input[key], max) || DEFAULT_GIVING[key];
  }
  const missingStop = (["reminderEn", "reminderAm", "emailReminderEn", "emailReminderAm"] as const).find((k) => !data[k].includes("{stop}"));
  if (data.includeStopLink && missingStop) return { ok: false, error: "Reminder messages must include {stop} so people can stop the reminders (or turn off the stop link)." };
  await saveSettings(data);
  return { ok: true };
}

export async function sendTestEmail(to: string, message: string): Promise<Result> {
  await requireUser();
  const address = s(to, 200);
  if (!isEmail(address)) return { ok: false, error: "Enter a valid email address." };
  const res = await sendEmail({
    to: address,
    subject: "Test email from the Omo Beeza dashboard",
    text: s(message, 5000) || "This is a test email from the Omo Beeza dashboard. If you can read it, email reminders are working.",
    kind: "test",
  });
  closeEmail();
  done();
  return res;
}

export async function runRemindersNow(): Promise<ReminderRun> {
  await requireUser();
  const run = await runReminders();
  done();
  return run;
}

// ---------------------------------------------------------------- Telegram bot

export interface TelegramStatus {
  configured: boolean;
  bot: string;
  connected: boolean;
  webhookUrl: string;
  lastError: string;
  linkedDonors: number;
}

export async function telegramStatus(): Promise<TelegramStatus> {
  await requireUser();
  const linked = (await queryOne<{ n: number }>("select count(*)::int as n from donors where telegram_chat_id is not null and deleted_at is null"))?.n ?? 0;
  if (!telegramConfigured()) return { configured: false, bot: "", connected: false, webhookUrl: "", lastError: "", linkedDonors: linked };
  const [bot, info] = await Promise.all([botUsername(), tg<{ url: string; last_error_message?: string }>("getWebhookInfo")]);
  const url = info.result?.url ?? "";
  return {
    configured: true,
    bot,
    connected: url.endsWith("/api/telegram/webhook"),
    webhookUrl: url,
    lastError: info.result?.last_error_message ?? (info.ok ? "" : (info.description ?? "")),
    linkedDonors: linked,
  };
}

/** Points the bot at this website, so it can answer donors and link their chats. */
export async function connectTelegramBot(): Promise<Result> {
  await requireUser();
  if (!telegramConfigured()) return { ok: false, error: "Add TELEGRAM_BOT_TOKEN to the environment variables first, then restart the app." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!host || /^(localhost|127\.|10\.|192\.168\.)/.test(host)) {
    return { ok: false, error: "Connect the bot from the live website (Telegram can't reach this computer)." };
  }
  const res = await tg("setWebhook", {
    url: `https://${host}/api/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!res.ok) return { ok: false, error: `Telegram: ${res.description ?? "failed"}` };
  await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Connect for giving reminders" },
      { command: "status", description: "Your gift" },
      { command: "stop", description: "Stop reminders here" },
    ],
  });
  return { ok: true };
}

export interface SubBotStatus {
  configured: boolean;
  bot: string;
  connected: boolean;
  lastError: string;
  /** Sub-admins signed in to the bot. */
  signedIn: number;
}

export async function subBotStatus(): Promise<SubBotStatus> {
  await requireUser();
  const signedIn = (await queryOne<{ n: number }>("select count(distinct registrar_id)::int as n from registrar_telegram"))?.n ?? 0;
  if (!subBotConfigured()) return { configured: false, bot: "", connected: false, lastError: "", signedIn };
  const [bot, info] = await Promise.all([subBotUsername(), subBot<{ url: string; last_error_message?: string }>("getWebhookInfo")]);
  return {
    configured: true,
    bot,
    connected: (info.result?.url ?? "").endsWith(SUBADMIN_WEBHOOK_PATH),
    lastError: info.result?.last_error_message ?? (info.ok ? "" : (info.description ?? "")),
    signedIn,
  };
}

/** Points the sub-admin bot at this website. */
export async function connectSubBot(): Promise<Result> {
  await requireUser();
  if (!subBotConfigured()) return { ok: false, error: "Add TELEGRAM_SUBADMIN_BOT_TOKEN to the environment variables first, then restart the app." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!host || /^(localhost|127\.|10\.|192\.168\.)/.test(host)) {
    return { ok: false, error: "Connect the bot from the live website (Telegram can't reach this computer)." };
  }
  const res = await subBot("setWebhook", {
    url: `https://${host}${SUBADMIN_WEBHOOK_PATH}`,
    secret_token: subBotSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!res.ok) return { ok: false, error: `Telegram: ${res.description ?? "failed"}` };
  await subBot("setMyCommands", {
    commands: [
      { command: "start", description: "Sign in / home" },
      { command: "register", description: "Register a donor" },
      { command: "progress", description: "Your progress" },
      { command: "donors", description: "The donors you registered" },
      { command: "extend", description: "Register more than your target" },
      { command: "cancel", description: "Stop the current step" },
      { command: "language", description: "English / አማርኛ" },
      { command: "logout", description: "Sign out" },
    ],
  });
  await subBot("setMyDescription", {
    description: "The Omo Beeza Ministry team bot. Sub-admins: register donors (sign in with your phone number and password). Admins: donors, payments, reminders and sub-admins (sign in with your dashboard email and password).",
  });
  return { ok: true };
}

export async function sendTelegramTest(donorId: number): Promise<Result> {
  await requireUser();
  const donor = await queryOne<DonorForSms>(
    "select id, name, phone, amount, reminder_day, frequency, month_day, locale, token, telegram_chat_id from donors where id = $1 and deleted_at is null",
    [donorId],
  );
  if (!donor?.telegram_chat_id) return { ok: false, error: "This donor hasn't connected the Telegram bot yet." };
  const giving = await readGivingNow();
  const res = await sendTelegram({
    chatId: donor.telegram_chat_id,
    text: donorMessage("reminder", donor, giving, "telegram"),
    button: giveButton(giving, donor.locale, donor.amount),
    kind: "manual",
    donorId: donor.id,
    label: `telegram:${donor.name}`,
  });
  done();
  return res;
}

// ---------------------------------------------------------------- Telegram invitations by email

const INVITE_WHERE = `deleted_at is null and status = 'active' and telegram_chat_id is null and telegram_invited_at is null and email <> ''`;

export async function inviteCounts(): Promise<{ withEmail: number }> {
  await requireUser();
  const row = await queryOne<{ n: number }>(`select count(*)::int as n from donors where ${INVITE_WHERE}`);
  return { withEmail: row?.n ?? 0 };
}

/** Emails donors who haven't connected the bot their one-tap link, once each. */
export async function inviteToTelegram(): Promise<Result & { sent?: number; failed?: number }> {
  await requireUser();
  const bot = await botUsername();
  if (!bot) return { ok: false, error: "Set up the Telegram bot first (TELEGRAM_BOT_TOKEN)." };
  if (!emailConfigured()) return { ok: false, error: "Set up email first (SMTP settings in the environment variables)." };
  const donors = await query<{ id: number; name: string; nickname: string; email: string; locale: string; token: string }>(
    `select id, name, nickname, email, locale, token from donors where ${INVITE_WHERE} order by id limit 200`,
  );
  let sent = 0;
  let failed = 0;
  for (const d of donors) {
    const first = d.nickname || (d.name.trim().split(/\s+/)[0] ?? d.name);
    const link = `https://t.me/${bot}?start=${d.token}`;
    const am = d.locale === "am";
    const res = await sendEmail({
      to: d.email,
      subject: am ? "የስጦታ ማሳሰቢያዎን በቴሌግራም ያግኙ" : "Get your giving reminders on Telegram",
      text: am
        ? `ሰላም ${first}፣\n\nየኦሞ ቤዛ የስጦታ ማሳሰቢያዎን በቴሌግራም ማግኘት ይችላሉ። ከታች ያለውን ቁልፍ ይጫኑ፣ ከዚያ በቴሌግራም "Start" ይጫኑ።\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት`
        : `Hi ${first},\n\nYou can get your Omo Beeza giving reminders on Telegram. Tap the button below, then press "Start" in Telegram.\n\nWith gratitude,\nOmo Beeza Ministry`,
      kind: "manual",
      donorId: d.id,
      button: { text: am ? "በቴሌግራም ይገናኙ" : "Connect on Telegram", url: link },
    });
    if (res.ok) {
      sent++;
      await query("update donors set telegram_invited_at = now() where id = $1", [d.id]);
    } else {
      failed++;
      if (failed >= 3 && sent === 0) break; // Email isn't working: don't burn through the list.
    }
  }
  closeEmail();
  done();
  return { ok: failed === 0, sent, failed, error: failed ? `${failed} email(s) failed (see the message log).` : undefined };
}

export async function telegramAccountStatus(): Promise<{ configured: boolean; ok: boolean; name?: string; username?: string; phone?: string; error?: string }> {
  await requireUser();
  if (!accountConfigured()) return { configured: false, ok: false };
  return { configured: true, ...(await accountInfo()) };
}
