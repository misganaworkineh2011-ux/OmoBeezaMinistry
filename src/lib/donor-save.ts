import "server-only";
import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { DONOR_STATUSES, asFrequency, isEmail, normalizePhone, normalizeTelegram, type DonorStatus, type Frequency } from "@/lib/giving";

// Adding or editing a donor's details: the dashboard's donor page and the
// app's "Edit donor" screen (POST /api/mobile/donors/[id]) both save here.

export type SaveResult = { ok: boolean; error?: string; id?: number };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface DonorInput {
  id?: number;
  name: string;
  nickname: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  frequency: Frequency;
  month_day: number;
  status: DonorStatus;
  locale: string;
  notes: string;
  telegram_username: string;
}

export async function saveDonorRecord(input: DonorInput): Promise<SaveResult> {
  const name = s(input.name, 80);
  const phoneRaw = s(input.phone, 30);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const email = s(input.email, 200).toLowerCase();
  const amount = Math.round(Number(input.amount));
  const day = Math.round(Number(input.reminder_day));
  const frequency = asFrequency(input.frequency, "weekly");
  const monthDay = Math.round(Number(input.month_day));
  const status: DonorStatus = DONOR_STATUSES.includes(input.status) ? input.status : "active";
  if (!name) return { ok: false, error: "Enter the donor’s name." };
  if (phone === null) return { ok: false, error: "Enter a valid Ethiopian mobile number (09… or 07…), or leave it empty." };
  if (email && !isEmail(email)) return { ok: false, error: "Enter a valid email address, or leave it empty." };
  if (!phone && !email) return { ok: false, error: "Enter an email address (for email reminders) or a mobile number (for SMS from the app)." };
  if (!(amount > 0)) return { ok: false, error: "Enter the amount in birr." };
  if (!(day >= 0 && day <= 6)) return { ok: false, error: "Choose a reminder day." };
  if (!(monthDay >= 1 && monthDay <= 28)) return { ok: false, error: "Choose a day of the month (1–28)." };
  const telegram = s(input.telegram_username, 60) ? normalizeTelegram(s(input.telegram_username, 60)) : "";
  if (telegram === null) return { ok: false, error: "That doesn't look like a Telegram username (5–32 letters, numbers or _)." };

  if (phone) {
    const clash = await queryOne<{ id: number; deleted_at: string | null }>("select id, deleted_at from donors where phone = $1 and id <> $2", [phone, input.id ?? 0]);
    if (clash) {
      return {
        ok: false,
        error: clash.deleted_at ? "A donor in the recycle bin has this phone number: restore them instead." : "Another donor already has this phone number.",
        id: clash.id,
      };
    }
  }

  const values = [name, phone, email, amount, day, status, input.locale === "am" ? "am" : "en", s(input.notes, 2000), telegram, s(input.nickname, 40), frequency, monthDay];
  if (input.id) {
    await query(
      `update donors set name=$1, phone=$2, email=$3, amount=$4, reminder_day=$5, status=$6, locale=$7, notes=$8, telegram_username=$9, nickname=$10, frequency=$11, month_day=$12,
         stopped_at = case when $6 = 'stopped' then coalesce(stopped_at, now()) else null end
       where id=$13`,
      [...values, input.id],
    );
    return { ok: true, id: input.id };
  }
  const row = await queryOne<{ id: number }>(
    `insert into donors (name, phone, email, amount, reminder_day, status, locale, notes, telegram_username, nickname, frequency, month_day, token, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'admin') returning id`,
    [...values, randomBytes(9).toString("base64url")],
  );
  return { ok: true, id: row?.id };
}
