import "server-only";
import { query } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import {
  dayName,
  ethiopiaWeekday,
  fillTemplate,
  type GivingSettings,
} from "@/lib/giving";
import { publicOrigin, sendSms, smsConfigured } from "@/lib/sms";
import {
  sendTelegram,
  telegramConfigured,
  type InlineButton,
} from "@/lib/telegram";
import {
  accountConfigured,
  closeAccount,
  sendFromAccount,
} from "@/lib/telegram-user";

export interface DonorForSms {
  id: number;
  name: string;
  phone: string;
  amount: number;
  reminder_day: number;
  locale: string;
  token: string;
  telegram_chat_id?: string | null;
  telegram_username?: string;
  telegram_user_status?: string;
  telegram_user_checked_at?: string | null;
}

/** Most messages the ministry account sends per run (Telegram limits accounts that message many people). */
const ACCOUNT_LIMIT = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Channel = "sms" | "telegram";

/** Where donors give (the Ye-Buna page, or the website's Donations page). */
export function giveLink(giving: GivingSettings, locale: string): string {
  return (
    giving.yebunaUrl ||
    `${publicOrigin()}${locale === "am" ? "/am" : ""}/donations`
  );
}

/**
 * The personalised text for one donor. On Telegram the "stop" part points to
 * the bot's /stop command instead of a web link.
 */
export function donorMessage(
  kind: "reminder" | "welcome",
  donor: DonorForSms,
  giving: GivingSettings,
  channel: Channel = "sms",
): string {
  const am = donor.locale === "am";
  const template =
    kind === "reminder"
      ? am
        ? giving.reminderAm
        : giving.reminderEn
      : am
        ? giving.welcomeAm
        : giving.welcomeEn;
  const origin = publicOrigin();
  return fillTemplate(template, {
    name: donor.name.split(/\s+/)[0] ?? donor.name,
    amount: donor.amount.toLocaleString("en-US"),
    day: dayName(donor.reminder_day, donor.locale),
    link: giveLink(giving, donor.locale),
    stop:
      channel === "telegram"
        ? "/stop"
        : `${origin}${am ? "/am" : ""}/stop/${donor.token}`,
  });
}

/** The "Give" button under Telegram reminders. */
export function giveButton(
  giving: GivingSettings,
  locale: string,
): InlineButton {
  const am = locale === "am";
  const text = giving.yebunaUrl
    ? am
      ? "❤ በየቡና ይስጡ"
      : "❤ Give on Ye-Buna"
    : am
      ? "❤ ይስጡ"
      : "❤ Give";
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
  if (!giving.remindersEnabled)
    return {
      weekday,
      due: 0,
      sent: 0,
      telegram: 0,
      skippedPaid: 0,
      failed: 0,
      disabled: true,
    };
  const useTelegram = giving.telegramEnabled && telegramConfigured();
  let useAccount =
    giving.telegramEnabled && giving.telegramUserEnabled && accountConfigured();
  let accountSends = 0;

  const due = await query<DonorForSms & { paid_recently: boolean }>(
    `select d.id, d.name, d.phone, d.amount, d.reminder_day, d.locale, d.token, d.telegram_chat_id,
            d.telegram_username, d.telegram_user_status, d.telegram_user_checked_at,
            exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - 6) as paid_recently
     from donors d
     where d.status = 'active' and d.reminder_day = $1
       and (d.last_reminded_at is null or d.last_reminded_at < now() - interval '20 hours')
     order by d.id limit $2`,
    [weekday, limit],
  );

  const run: ReminderRun = {
    weekday,
    due: due.length,
    sent: 0,
    telegram: 0,
    skippedPaid: 0,
    failed: 0,
  };
  try {
    for (const donor of due) {
      if (giving.skipIfPaid && donor.paid_recently) {
        run.skippedPaid++;
        await query(
          "update donors set last_reminded_at = now() where id = $1",
          [donor.id],
        );
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
      // Not connected to the bot: try the ministry's Telegram account (by
      // @username or phone). Numbers found not to be on Telegram are re-checked
      // only once a month.
      const recentlyMissing =
        donor.telegram_user_status === "not_on_telegram" &&
        donor.telegram_user_checked_at &&
        Date.now() - new Date(donor.telegram_user_checked_at).getTime() <
          30 * 86_400_000;
      if (
        !viaTelegram &&
        useAccount &&
        accountSends < ACCOUNT_LIMIT &&
        !recentlyMissing
      ) {
        if (accountSends > 0) await sleep(1500);
        accountSends++;
        const acc = await sendFromAccount(
          {
            id: donor.id,
            name: donor.name,
            phone: donor.phone,
            telegram_username: donor.telegram_username ?? "",
          },
          donorMessage("reminder", donor, giving),
        );
        if (acc.ok) {
          reached = viaTelegram = true;
          run.telegram++;
        } else if (acc.status === "flood") {
          useAccount = false; // Telegram asked us to slow down: SMS for the rest today.
        }
      }

      // SMS for everyone not reached on Telegram (or also for them, if chosen).
      if ((!viaTelegram || !giving.telegramReplacesSms) && smsConfigured()) {
        const sms = await sendSms({
          to: donor.phone,
          message: donorMessage("reminder", donor, giving),
          kind: "reminder",
          donorId: donor.id,
        });
        if (sms.ok) {
          reached = true;
          run.sent++;
        }
      }
      if (reached)
        await query(
          "update donors set last_reminded_at = now() where id = $1",
          [donor.id],
        );
      else run.failed++;
    }
  } finally {
    if (accountSends > 0) await closeAccount();
  }
  return run;
}
