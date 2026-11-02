import "server-only";
import { query } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { dayName, ethiopiaWeekday, fillTemplate, type GivingSettings } from "@/lib/giving";
import { publicOrigin, sendSms, smsConfigured } from "@/lib/sms";
import { sendTelegram, telegramConfigured, type InlineButton } from "@/lib/telegram";

export interface DonorForSms {
  id: number;
  name: string;
  phone: string;
  amount: number;
  reminder_day: number;
  locale: string;
  token: string;
  telegram_chat_id?: string | null;
}

export type Channel = "sms" | "telegram";

/** Where donors give (the Ye-Buna page, or the website's Donations page). */
export function giveLink(giving: GivingSettings, locale: string): string {
  return giving.yebunaUrl || `${publicOrigin()}${locale === "am" ? "/am" : ""}/donations`;
}

/**
 * The personalised text for one donor. On Telegram the "stop" part points to
 * the bot's /stop command instead of a web link.
 */
export function donorMessage(kind: "reminder" | "welcome", donor: DonorForSms, giving: GivingSettings, channel: Channel = "sms"): string {
  const am = donor.locale === "am";
  const template = kind === "reminder" ? (am ? giving.reminderAm : giving.reminderEn) : am ? giving.welcomeAm : giving.welcomeEn;
  const origin = publicOrigin();
  return fillTemplate(template, {
    name: donor.name.split(/\s+/)[0] ?? donor.name,
    amount: donor.amount.toLocaleString("en-US"),
    day: dayName(donor.reminder_day, donor.locale),
    link: giveLink(giving, donor.locale),
    stop: channel === "telegram" ? "/stop" : `${origin}${am ? "/am" : ""}/stop/${donor.token}`,
  });
}

/** The "Give" button under Telegram reminders. */
export function giveButton(giving: GivingSettings, locale: string): InlineButton {
  const am = locale === "am";
  const text = giving.yebunaUrl ? (am ? "❤ በየቡና ይስጡ" : "❤ Give on Ye-Buna") : am ? "❤ ይስጡ" : "❤ Give";
  return { text, url: giveLink(giving, locale) };
}

export interface ReminderRun {
  weekday: number;
  due: number;
  sent: number;
  telegram: number;
  skippedPaid: number;
  failed: number;
  disabled?: boolean;
}

/**
 * Sends today's weekly reminders: active donors whose reminder day is today
 * (Ethiopian time) and who haven't been reminded in the last 20 hours. Donors
 * connected to the Telegram bot get it there; SMS goes to everyone else (and
 * to them too unless "Telegram replaces SMS" is on). Safe to run more than
 * once a day. Called by the daily cron job and from the dashboard.
 */
export async function runReminders(limit = 300): Promise<ReminderRun> {
  const giving = await readGivingNow();
  const weekday = ethiopiaWeekday();
  if (!giving.remindersEnabled) return { weekday, due: 0, sent: 0, telegram: 0, skippedPaid: 0, failed: 0, disabled: true };
  const useTelegram = giving.telegramEnabled && telegramConfigured();

  const due = await query<DonorForSms & { paid_recently: boolean }>(
    `select d.id, d.name, d.phone, d.amount, d.reminder_day, d.locale, d.token, d.telegram_chat_id,
            exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - 6) as paid_recently
     from donors d
     where d.status = 'active' and d.reminder_day = $1
       and (d.last_reminded_at is null or d.last_reminded_at < now() - interval '20 hours')
     order by d.id limit $2`,
    [weekday, limit],
  );

  const run: ReminderRun = { weekday, due: due.length, sent: 0, telegram: 0, skippedPaid: 0, failed: 0 };
  for (const donor of due) {
    if (giving.skipIfPaid && donor.paid_recently) {
      run.skippedPaid++;
      await query("update donors set last_reminded_at = now() where id = $1", [donor.id]);
      continue;
    }

    let reached = false;
    let viaTelegram = false;
    if (useTelegram && donor.telegram_chat_id) {
      const tg = await sendTelegram({
        chatId: donor.telegram_chat_id,
        text: donorMessage("reminder", donor, giving, "telegram"),
        button: giveButton(giving, donor.locale),
        kind: "reminder",
        donorId: donor.id,
        label: `telegram:${donor.name}`,
      });
      if (tg.ok) {
        reached = viaTelegram = true;
        run.telegram++;
      }
    }
    // SMS for everyone not reached on Telegram (or also for them, if chosen).
    if ((!viaTelegram || !giving.telegramReplacesSms) && smsConfigured()) {
      const sms = await sendSms({ to: donor.phone, message: donorMessage("reminder", donor, giving), kind: "reminder", donorId: donor.id });
      if (sms.ok) {
        reached = true;
        run.sent++;
      }
    }
    if (reached) await query("update donors set last_reminded_at = now() where id = $1", [donor.id]);
    else run.failed++;
  }
  return run;
}
