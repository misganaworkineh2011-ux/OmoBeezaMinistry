import "server-only";
import { query } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import {
  callName,
  ethiopiaToday,
  periodWords,
  scheduleDay,
  fillTemplate,
  type GivingSettings,
  templateFor,
  yebunaLink,
} from "@/lib/giving";
import { closeEmail, emailConfigured, sendEmail } from "@/lib/email";
import { publicOrigin } from "@/lib/origin";
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
  nickname?: string;
  phone: string;
  email?: string;
  amount: number;
  reminder_day: number;
  /** "weekly" or "monthly" (missing = weekly). */
  frequency?: string;
  /** Day of the month 1–28, for monthly donors. */
  month_day?: number;
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

export type Channel = "sms" | "telegram" | "email";

/**
 * Where a donor gives, on the ministry's own address: /give/250 forwards to
 * the Ye-Buna payment page for that amount (or the general Ye-Buna page, see
 * src/app/give). Without any Ye-Buna link it is the website's Donations page.
 */
export function giveLink(
  giving: GivingSettings,
  locale: string,
  amount?: number,
): string {
  if (yebunaLink(giving, amount)) return `${publicOrigin()}/give${amount ? `/${amount}` : ""}`;
  return `${publicOrigin()}${locale === "am" ? "/am" : ""}/donations`;
}

/** The values for {placeholders} in every template. */
export function templateValues(
  donor: DonorForSms,
  giving: GivingSettings,
  channel: Channel,
): Record<string, string> {
  const am = donor.locale === "am";
  return {
    name: callName(donor.name, donor.nickname),
    fullname: donor.name,
    amount: donor.amount.toLocaleString("en-US"),
    day: scheduleDay(donor.frequency ?? "weekly", donor.reminder_day, donor.month_day ?? 1, donor.locale),
    ...periodWords(donor.frequency ?? "weekly", donor.locale),
    link: giveLink(giving, donor.locale, donor.amount),
    stop:
      channel === "telegram"
        ? "/stop"
        : `${publicOrigin()}${am ? "/am" : ""}/stop/${donor.token}`,
  };
}

/**
 * The personalised SMS / Telegram text for one donor. On Telegram the "stop"
 * part points to the bot's /stop command instead of a web link.
 */
export function donorMessage(
  kind: "reminder" | "welcome",
  donor: DonorForSms,
  giving: GivingSettings,
  channel: "sms" | "telegram" = "sms",
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
  return fillTemplate(templateFor(giving, template), templateValues(donor, giving, channel));
}

/** The personalised email (subject and text) for one donor. */
export function donorEmail(
  kind: "reminder" | "welcome",
  donor: DonorForSms,
  giving: GivingSettings,
): { subject: string; text: string } {
  const am = donor.locale === "am";
  const values = templateValues(donor, giving, "email");
  const [subject, body] =
    kind === "reminder"
      ? am
        ? [giving.emailReminderSubjectAm, giving.emailReminderAm]
        : [giving.emailReminderSubjectEn, giving.emailReminderEn]
      : am
        ? [giving.emailWelcomeSubjectAm, giving.emailWelcomeAm]
        : [giving.emailWelcomeSubjectEn, giving.emailWelcomeEn];
  return {
    subject: fillTemplate(templateFor(giving, subject), values),
    text: fillTemplate(templateFor(giving, body), values, true),
  };
}

/** Email one donor their reminder or welcome, with a "Give" button. */
export function emailDonor(
  kind: "reminder" | "welcome",
  donor: DonorForSms & { email: string },
  giving: GivingSettings,
) {
  const { subject, text } = donorEmail(kind, donor, giving);
  return sendEmail({
    to: donor.email,
    subject,
    text,
    kind,
    donorId: donor.id,
    button: giveButton(giving, donor.locale, donor.amount),
    unsubscribe: donor.token,
  });
}

/** The "Give" button under Telegram reminders and in emails. */
export function giveButton(
  giving: GivingSettings,
  locale: string,
  amount?: number,
): InlineButton & { url: string } {
  const am = locale === "am";
  const text = am ? "❤ ይለግሱ" : "❤ Donate";
  return { text, url: giveLink(giving, locale, amount) };
}

export interface ReminderRun {
  weekday: number;
  /** Day of the month (Ethiopian time) for monthly donors. */
  monthDay: number;
  due: number;
  /** Emails sent. */
  sent: number;
  telegram: number;
  skippedPaid: number;
  failed: number;
  /** Not reached here but have a phone number: the app's "Send SMS reminders" sends them an SMS. */
  phoneOnly: number;
  disabled?: boolean;
}

/**
 * Sends today's reminders: active donors whose reminder day is today — their
 * weekday (weekly donors) or their day of the month (monthly donors)
 * (Ethiopian time) and who haven't been reminded in the last 20 hours. Donors
 * connected to the Telegram bot get it there, then the ministry's Telegram
 * account is tried, and everyone with an email gets the email (unless
 * "Telegram replaces email" is on and Telegram reached them). Donors with only
 * a phone number are left for the Android app's "Send SMS reminders". Safe to
 * run more than once a day. Called by the daily cron job and from the dashboard.
 */
export async function runReminders(limit = 300): Promise<ReminderRun> {
  const giving = await readGivingNow();
  const { weekday, monthDay } = ethiopiaToday();
  const run: ReminderRun = {
    weekday,
    monthDay,
    due: 0,
    sent: 0,
    telegram: 0,
    skippedPaid: 0,
    failed: 0,
    phoneOnly: 0,
  };
  if (!giving.remindersEnabled) return { ...run, disabled: true };
  const useTelegram = giving.telegramEnabled && telegramConfigured();
  let useAccount =
    giving.telegramEnabled && giving.telegramUserEnabled && accountConfigured();
  const useEmail = emailConfigured();
  let accountSends = 0;

  const due = await query<
    DonorForSms & { email: string; paid_recently: boolean }
  >(
    `select d.id, d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.frequency, d.month_day, d.locale, d.token, d.telegram_chat_id,
            d.telegram_username, d.telegram_user_status, d.telegram_user_checked_at,
            exists (select 1 from donor_payments p where p.donor_id = d.id
              and p.paid_on > current_date - (case when d.frequency = 'monthly' then 25 else 6 end)) as paid_recently
     from donors d
     where d.status = 'active' and d.deleted_at is null
       and ((d.frequency = 'monthly' and d.month_day = $3) or (d.frequency <> 'monthly' and d.reminder_day = $1))
       and (d.last_reminded_at is null or d.last_reminded_at < now() - interval '20 hours')
     order by d.id limit $2`,
    [weekday, limit, monthDay],
  );
  run.due = due.length;

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
          button: giveButton(giving, donor.locale, donor.amount),
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
        !recentlyMissing &&
        (donor.phone || donor.telegram_username)
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
          useAccount = false; // Telegram asked us to slow down: the rest get email / SMS.
        }
      }

      // Email for everyone not reached on Telegram (or also for them, if chosen).
      if (
        donor.email &&
        useEmail &&
        (!viaTelegram || !giving.telegramReplacesSms)
      ) {
        const mail = await emailDonor("reminder", donor, giving);
        if (mail.ok) {
          reached = true;
          run.sent++;
        }
      }
      if (reached)
        await query(
          "update donors set last_reminded_at = now() where id = $1",
          [donor.id],
        );
      else if (donor.phone) run.phoneOnly++; // the app sends them an SMS
      else run.failed++;
    }
  } finally {
    if (accountSends > 0) await closeAccount();
    closeEmail();
  }
  return run;
}
