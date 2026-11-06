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
  type DonorStatus,
  type GivingSettings,
  type TemplateKey,
} from "@/lib/giving";
import { donorMessage, emailDonor, giveButton, runReminders, type DonorForSms, type ReminderRun } from "@/lib/reminders";
import { botUsername, sendTelegram, telegramConfigured, tg, webhookSecret } from "@/lib/telegram";
import { accountConfigured, accountInfo } from "@/lib/telegram-user";
import { closeEmail, emailConfigured, sendEmail } from "@/lib/email";

type Result = { ok: boolean; error?: string; id?: number };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const done = () => revalidatePath("/admin", "layout");

export interface DonorInput {
  id?: number;
  name: string;
  nickname: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  status: DonorStatus;
  locale: string;
  notes: string;
  telegram_username: string;
}

export async function saveDonor(input: DonorInput): Promise<Result> {
  await requireUser();
  const name = s(input.name, 80);
  const phoneRaw = s(input.phone, 30);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const email = s(input.email, 200).toLowerCase();
  const amount = Math.round(Number(input.amount));
  const day = Math.round(Number(input.reminder_day));
  const status: DonorStatus = DONOR_STATUSES.includes(input.status) ? input.status : "active";
  if (!name) return { ok: false, error: "Enter the donor’s name." };
  if (phone === null) return { ok: false, error: "Enter a valid Ethiopian mobile number (09… or 07…), or leave it empty." };
  if (email && !isEmail(email)) return { ok: false, error: "Enter a valid email address, or leave it empty." };
  if (!phone && !email) return { ok: false, error: "Enter an email address (for email reminders) or a mobile number (for SMS from the app)." };
  if (!(amount > 0)) return { ok: false, error: "Enter the weekly amount in birr." };
  if (!(day >= 0 && day <= 6)) return { ok: false, error: "Choose a reminder day." };
  const telegram = s(input.telegram_username, 60) ? normalizeTelegram(s(input.telegram_username, 60)) : "";
  if (telegram === null) return { ok: false, error: "That doesn't look like a Telegram username (5–32 letters, numbers or _)." };

  if (phone) {
    const clash = await queryOne<{ id: number }>("select id from donors where phone = $1 and id <> $2", [phone, input.id ?? 0]);
    if (clash) return { ok: false, error: "Another donor already has this phone number.", id: clash.id };
  }

  const values = [name, phone, email, amount, day, status, input.locale === "am" ? "am" : "en", s(input.notes, 2000), telegram, s(input.nickname, 40)];
  if (input.id) {
    await query(
      `update donors set name=$1, phone=$2, email=$3, amount=$4, reminder_day=$5, status=$6, locale=$7, notes=$8, telegram_username=$9, nickname=$10,
         stopped_at = case when $6 = 'stopped' then coalesce(stopped_at, now()) else null end
       where id=$11`,
      [...values, input.id],
    );
    done();
    return { ok: true, id: input.id };
  }
  const row = await queryOne<{ id: number }>(
    `insert into donors (name, phone, email, amount, reminder_day, status, locale, notes, telegram_username, nickname, token, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'admin') returning id`,
    [...values, randomBytes(9).toString("base64url")],
  );
  done();
  return { ok: true, id: row?.id };
}

export async function deleteDonor(id: number): Promise<void> {
  await requireUser();
  await query("delete from donors where id = $1", [id]);
  done();
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

/** Email a donor now: their weekly reminder, or a custom message. */
export async function emailDonorNow(donorId: number, subject: string, custom: string): Promise<Result> {
  await requireUser();
  const donor = await queryOne<DonorForSms & { email: string }>(
    "select id, name, nickname, phone, email, amount, reminder_day, locale, token from donors where id = $1",
    [donorId],
  );
  if (!donor) return { ok: false, error: "Donor not found." };
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
export async function saveTemplates(input: Record<TemplateKey, string>): Promise<Result> {
  await requireUser();
  const data = { ...(await readGivingNow()) };
  for (const key of TEMPLATE_KEYS) {
    const max = key.includes("Subject") ? 200 : key.startsWith("email") ? 5000 : 900;
    data[key] = s(input[key], max) || DEFAULT_GIVING[key];
  }
  const missingStop = (["reminderEn", "reminderAm", "emailReminderEn", "emailReminderAm"] as const).find((k) => !data[k].includes("{stop}"));
  if (missingStop) return { ok: false, error: "Reminder messages must include {stop} so people can stop the reminders." };
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
  const linked = (await queryOne<{ n: number }>("select count(*)::int as n from donors where telegram_chat_id is not null"))?.n ?? 0;
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
  if (!telegramConfigured()) return { ok: false, error: "Add TELEGRAM_BOT_TOKEN in Vercel first, then redeploy." };
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
      { command: "start", description: "Connect for weekly giving reminders" },
      { command: "status", description: "Your weekly gift" },
      { command: "stop", description: "Stop reminders here" },
    ],
  });
  return { ok: true };
}

export async function sendTelegramTest(donorId: number): Promise<Result> {
  await requireUser();
  const donor = await queryOne<DonorForSms>(
    "select id, name, phone, amount, reminder_day, locale, token, telegram_chat_id from donors where id = $1",
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

const INVITE_WHERE = `status = 'active' and telegram_chat_id is null and telegram_invited_at is null and email <> ''`;

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
  if (!emailConfigured()) return { ok: false, error: "Set up email first (SMTP settings in Vercel)." };
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
      subject: am ? "ሳምንታዊ ማሳሰቢያዎን በቴሌግራም ያግኙ" : "Get your weekly reminders on Telegram",
      text: am
        ? `ሰላም ${first}፣\n\nሳምንታዊ የኦሞ ቤዛ የስጦታ ማሳሰቢያዎን በቴሌግራም ማግኘት ይችላሉ። ከታች ያለውን ቁልፍ ይጫኑ፣ ከዚያ በቴሌግራም "Start" ይጫኑ።\n\nከምስጋና ጋር፣\nኦሞ ቤዛ አገልግሎት`
        : `Hi ${first},\n\nYou can get your weekly Omo Beeza giving reminders on Telegram. Tap the button below, then press "Start" in Telegram.\n\nWith gratitude,\nOmo Beeza Ministry`,
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
