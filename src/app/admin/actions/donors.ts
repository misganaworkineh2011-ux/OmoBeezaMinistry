"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { readGivingNow } from "@/lib/data/giving";
import { DEFAULT_GIVING, DONOR_STATUSES, normalizePhone, normalizeTelegram, type DonorStatus, type GivingSettings } from "@/lib/giving";
import { donorMessage, giveButton, runReminders, type DonorForSms, type ReminderRun } from "@/lib/reminders";
import { botUsername, sendTelegram, telegramConfigured, tg, webhookSecret } from "@/lib/telegram";
import { sendSms } from "@/lib/sms";

type Result = { ok: boolean; error?: string; id?: number };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const done = () => revalidatePath("/admin", "layout");

export interface DonorInput {
  id?: number;
  name: string;
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
  const phone = normalizePhone(s(input.phone, 30));
  const email = s(input.email, 200);
  const amount = Math.round(Number(input.amount));
  const day = Math.round(Number(input.reminder_day));
  const status: DonorStatus = DONOR_STATUSES.includes(input.status) ? input.status : "active";
  if (!name) return { ok: false, error: "Enter the donor’s name." };
  if (!phone) return { ok: false, error: "Enter a valid Ethiopian mobile number (09… or 07…)." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address or leave it empty." };
  if (!(amount > 0)) return { ok: false, error: "Enter the weekly amount in birr." };
  if (!(day >= 0 && day <= 6)) return { ok: false, error: "Choose a reminder day." };
  const telegram = s(input.telegram_username, 60) ? normalizeTelegram(s(input.telegram_username, 60)) : "";
  if (telegram === null) return { ok: false, error: "That doesn't look like a Telegram username (5–32 letters, numbers or _)." };

  const clash = await queryOne<{ id: number }>("select id from donors where phone = $1 and id <> $2", [phone, input.id ?? 0]);
  if (clash) return { ok: false, error: "Another donor already has this phone number.", id: clash.id };

  const values = [name, phone, email, amount, day, status, input.locale === "am" ? "am" : "en", s(input.notes, 2000), telegram];
  if (input.id) {
    await query(
      `update donors set name=$1, phone=$2, email=$3, amount=$4, reminder_day=$5, status=$6, locale=$7, notes=$8, telegram_username=$9,
         stopped_at = case when $6 = 'stopped' then coalesce(stopped_at, now()) else null end
       where id=$10`,
      [...values, input.id],
    );
    done();
    return { ok: true, id: input.id };
  }
  const row = await queryOne<{ id: number }>(
    `insert into donors (name, phone, email, amount, reminder_day, status, locale, notes, telegram_username, token, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'admin') returning id`,
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

/** Send one SMS to a donor now: their reminder text, or a custom message. */
export async function smsDonor(donorId: number, custom: string): Promise<Result> {
  await requireUser();
  const donor = await queryOne<DonorForSms>("select id, name, phone, amount, reminder_day, locale, token from donors where id = $1", [donorId]);
  if (!donor) return { ok: false, error: "Donor not found." };
  const message = s(custom, 900) || donorMessage("reminder", donor, await readGivingNow());
  const res = await sendSms({ to: donor.phone, message, kind: custom.trim() ? "manual" : "reminder", donorId });
  if (res.ok && !custom.trim()) await query("update donors set last_reminded_at = now() where id = $1", [donorId]);
  done();
  return res;
}

// ---------------------------------------------------------------- Settings

export async function saveGiving(input: GivingSettings): Promise<Result> {
  await requireUser();
  const url = s(input.yebunaUrl, 300);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) return { ok: false, error: "The Ye-Buna link must start with https://" };
  const amounts = [...new Set((input.amounts ?? []).map((n) => Math.round(Number(n))).filter((n) => n > 0))].sort((a, b) => a - b).slice(0, 12);
  if (amounts.length === 0) return { ok: false, error: "Add at least one suggested amount." };
  const templates = ["reminderEn", "reminderAm", "welcomeEn", "welcomeAm"] as const;
  const data: GivingSettings = {
    yebunaUrl: url,
    amounts,
    minAmount: Math.max(1, Math.round(Number(input.minAmount)) || DEFAULT_GIVING.minAmount),
    defaultDay: Math.min(6, Math.max(0, Math.round(Number(input.defaultDay)) || 0)),
    remindersEnabled: Boolean(input.remindersEnabled),
    welcomeEnabled: Boolean(input.welcomeEnabled),
    skipIfPaid: Boolean(input.skipIfPaid),
    telegramEnabled: Boolean(input.telegramEnabled),
    telegramReplacesSms: Boolean(input.telegramReplacesSms),
    reminderEn: s(input.reminderEn, 900) || DEFAULT_GIVING.reminderEn,
    reminderAm: s(input.reminderAm, 900) || DEFAULT_GIVING.reminderAm,
    welcomeEn: s(input.welcomeEn, 900) || DEFAULT_GIVING.welcomeEn,
    welcomeAm: s(input.welcomeAm, 900) || DEFAULT_GIVING.welcomeAm,
  };
  for (const key of templates) {
    if (key.startsWith("reminder") && !data[key].includes("{stop}")) {
      return { ok: false, error: "Reminder messages must include {stop} so people can stop the reminders." };
    }
  }
  await query("insert into settings (key, data) values ('giving', $1) on conflict (key) do update set data = excluded.data, updated_at = now()", [
    JSON.stringify(data),
  ]);
  refresh("settings");
  return { ok: true };
}

export async function sendTestSms(phone: string, message: string): Promise<Result> {
  await requireUser();
  const to = normalizePhone(s(phone, 30));
  if (!to) return { ok: false, error: "Enter a valid Ethiopian mobile number." };
  const res = await sendSms({ to, message: s(message, 900) || "Test message from the Omo Beeza dashboard.", kind: "test" });
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
    allowed_updates: ["message"],
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
    button: giveButton(giving, donor.locale),
    kind: "manual",
    donorId: donor.id,
    label: `telegram:${donor.name}`,
  });
  done();
  return res;
}
