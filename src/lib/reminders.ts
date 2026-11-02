import "server-only";
import { query } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { dayName, ethiopiaWeekday, fillTemplate, type GivingSettings } from "@/lib/giving";
import { publicOrigin, sendSms } from "@/lib/sms";

export interface DonorForSms {
  id: number;
  name: string;
  phone: string;
  amount: number;
  reminder_day: number;
  locale: string;
  token: string;
}

/** The personalised text for one donor. */
export function donorMessage(kind: "reminder" | "welcome", donor: DonorForSms, giving: GivingSettings): string {
  const am = donor.locale === "am";
  const template = kind === "reminder" ? (am ? giving.reminderAm : giving.reminderEn) : am ? giving.welcomeAm : giving.welcomeEn;
  const origin = publicOrigin();
  return fillTemplate(template, {
    name: donor.name.split(/\s+/)[0] ?? donor.name,
    amount: donor.amount.toLocaleString("en-US"),
    day: dayName(donor.reminder_day, donor.locale),
    link: giving.yebunaUrl || `${origin}${am ? "/am" : ""}/donations`,
    stop: `${origin}${am ? "/am" : ""}/stop/${donor.token}`,
  });
}

export interface ReminderRun {
  weekday: number;
  due: number;
  sent: number;
  skippedPaid: number;
  failed: number;
  disabled?: boolean;
}

/**
 * Sends today's weekly reminders: active donors whose reminder day is today
 * (Ethiopian time) and who haven't been reminded in the last 20 hours. Safe
 * to run more than once a day. Called by the daily cron job and from the
 * dashboard.
 */
export async function runReminders(limit = 300): Promise<ReminderRun> {
  const giving = await readGivingNow();
  const weekday = ethiopiaWeekday();
  if (!giving.remindersEnabled) return { weekday, due: 0, sent: 0, skippedPaid: 0, failed: 0, disabled: true };

  const due = await query<DonorForSms & { paid_recently: boolean }>(
    `select d.id, d.name, d.phone, d.amount, d.reminder_day, d.locale, d.token,
            exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - 6) as paid_recently
     from donors d
     where d.status = 'active' and d.reminder_day = $1
       and (d.last_reminded_at is null or d.last_reminded_at < now() - interval '20 hours')
     order by d.id limit $2`,
    [weekday, limit],
  );

  const run: ReminderRun = { weekday, due: due.length, sent: 0, skippedPaid: 0, failed: 0 };
  for (const donor of due) {
    if (giving.skipIfPaid && donor.paid_recently) {
      run.skippedPaid++;
      await query("update donors set last_reminded_at = now() where id = $1", [donor.id]);
      continue;
    }
    const res = await sendSms({ to: donor.phone, message: donorMessage("reminder", donor, giving), kind: "reminder", donorId: donor.id });
    if (res.ok) {
      run.sent++;
      await query("update donors set last_reminded_at = now() where id = $1", [donor.id]);
    } else {
      run.failed++;
    }
  }
  return run;
}
