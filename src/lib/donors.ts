import "server-only";
import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { asFrequency, isEmail, normalizePhone, normalizeTelegram } from "@/lib/giving";
import { emailDonor, giveLink, type DonorForSms } from "@/lib/reminders";
import { connectLink } from "@/lib/telegram";

// Registering a weekly donor, shared by the website form (/api/donors, by
// email), the Android app (/api/mobile/donors, by phone) and the Telegram bot
// (by phone). Registering the same phone number (or, without one, the same
// email) again updates the commitment instead of creating a duplicate.

export interface RegisterInput {
  name: unknown;
  nickname?: unknown;
  phone?: unknown;
  email?: unknown;
  amount: unknown;
  /** Weekday 0–6 (weekly donors). */
  day?: unknown;
  /** "weekly" or "monthly"; left out (older apps) = weekly. */
  frequency?: unknown;
  /** Day of the month 1–28 (monthly donors). */
  monthDay?: unknown;
  locale?: unknown;
  notes?: unknown;
  telegram?: unknown;
  source: "website" | "app" | "telegram" | "registrar" | "admin";
  /** The sub-admin registering the donor (counts toward their target). */
  registeredBy?: number;
  /** Refuse a phone/email that is already registered instead of updating it (sub-admins). */
  noUpdate?: boolean;
  /** Which contact detail is required: the website asks for email, the app and the bot for a phone number. */
  requires: "email" | "phone";
  /** Skip the welcome email (e.g. the bot welcomes them on Telegram instead). */
  noWelcome?: boolean;
  /** Don't queue a welcome SMS (the sub-admin bot hands the welcome to the registrar to forward). */
  noWelcomeSms?: boolean;
}

export type RegisterResult =
  | {
      ok: true;
      donor: DonorForSms;
      created: boolean;
      link: string;
      telegramLink: string;
      /** A welcome SMS is waiting for the app's "Send SMS reminders" (phone, and no welcome email). */
      welcomePending: boolean;
    }
  | { ok: false; error: "invalid_name" | "invalid_phone" | "invalid_email" | "invalid_amount" | "invalid_day" | "invalid_telegram" | "already_registered" | "save_failed"; min?: number };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const RETURNING = "id, name, nickname, phone, email, amount, reminder_day, frequency, month_day, locale, token, telegram_chat_id";

export async function registerDonor(input: RegisterInput): Promise<RegisterResult> {
  const giving = await readGivingNow();
  const name = text(input.name, 80);
  const nickname = text(input.nickname, 40);
  const phoneRaw = text(input.phone, 30);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const email = text(input.email, 200).toLowerCase();
  const amount = Math.round(Number(input.amount));
  const frequency = asFrequency(input.frequency, "weekly");
  const given = (v: unknown) => v !== undefined && v !== null && v !== "";
  const day = given(input.day) ? Math.round(Number(input.day)) : giving.defaultDay;
  const monthDay = given(input.monthDay) ? Math.round(Number(input.monthDay)) : giving.defaultMonthDay;
  const locale = input.locale === "am" ? "am" : "en";

  if (!name) return { ok: false, error: "invalid_name" };
  if (phone === null || (input.requires === "phone" && !phone)) return { ok: false, error: "invalid_phone" };
  if ((email && !isEmail(email)) || (input.requires === "email" && !email)) return { ok: false, error: "invalid_email" };
  if (!Number.isFinite(amount) || amount < giving.minAmount || amount > 1_000_000) return { ok: false, error: "invalid_amount", min: giving.minAmount };
  if (!(day >= 0 && day <= 6) || !(monthDay >= 1 && monthDay <= 28)) return { ok: false, error: "invalid_day" };
  const telegramRaw = text(input.telegram, 60);
  const telegram = telegramRaw ? normalizeTelegram(telegramRaw) : "";
  if (telegram === null) return { ok: false, error: "invalid_telegram" };
  const notes = text(input.notes, 2000);

  let donor: (DonorForSms & { email: string }) | null;
  let wasActive = false;
  let created = false;
  try {
    // The same person again: by phone number, or by email when there is no phone.
    const existing = phone
      ? await queryOne<{ id: number; status: string; deleted_at: string | null }>("select id, status, deleted_at from donors where phone = $1", [phone])
      : await queryOne<{ id: number; status: string; deleted_at: string | null }>(
          "select id, status, deleted_at from donors where lower(email) = $1 order by (deleted_at is null) desc, (phone = '') desc, id limit 1",
          [email],
        );
    // A donor in the recycle bin who registers again comes back (with their history).
    const fromBin = Boolean(existing?.deleted_at);
    if (existing && input.noUpdate && !fromBin) return { ok: false, error: "already_registered" };
    wasActive = existing?.status === "active" && !fromBin;
    created = !existing || fromBin;
    donor = existing
      ? await queryOne(
          `update donors set name = $1,
             nickname = case when $2 <> '' then $2 else nickname end,
             phone = case when $3 <> '' then $3 else phone end,
             email = case when $4 <> '' then $4 else email end,
             amount = $5, reminder_day = $6, locale = $7,
             notes = case when $8 <> '' then $8 else notes end,
             telegram_username = case when $9 <> '' then $9 else telegram_username end,
             frequency = $11, month_day = $12,
             status = 'active', stopped_at = null, deleted_at = null,
             registered_by = coalesce($13, registered_by)
           where id = $10 returning ${RETURNING}`,
          [name, nickname, phone, email, amount, day, locale, notes, telegram, existing.id, frequency, monthDay, fromBin ? (input.registeredBy ?? null) : null],
        )
      : await queryOne(
          `insert into donors (name, nickname, phone, email, amount, reminder_day, locale, token, notes, source, telegram_username, registered_by, frequency, month_day)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning ${RETURNING}`,
          [name, nickname, phone, email, amount, day, locale, randomBytes(9).toString("base64url"), notes, input.source, telegram, input.registeredBy ?? null, frequency, monthDay],
        );
  } catch (err) {
    console.error("donors: save failed", err);
    return { ok: false, error: "save_failed" };
  }
  if (!donor) return { ok: false, error: "save_failed" };

  // Welcome new (or returning) donors only, not someone updating their amount.
  // A failed email doesn't undo the registration; it shows in the message log.
  const welcome = giving.welcomeEnabled && !wasActive && !input.noWelcome;
  const mailed = welcome && donor.email ? (await emailDonor("welcome", donor, giving)).ok : false;
  // Donors with a phone who didn't get the welcome email get a welcome SMS, but
  // only when someone presses "Send SMS reminders" in the app (never automatically).
  const welcomePending = Boolean(welcome && !input.noWelcomeSms && donor.phone && !mailed);
  if (welcomePending) await query("update donors set welcome_pending = true where id = $1", [donor.id]).catch(() => undefined);
  return {
    ok: true,
    donor,
    created,
    link: giveLink(giving, donor.locale, donor.amount),
    telegramLink: await connectLink(donor.token),
    welcomePending,
  };
}

/** Days a donor stays in the recycle bin before being deleted for good. */
export const BIN_DAYS = 30;

/** Permanently deletes donors that have been in the recycle bin for more than BIN_DAYS days. */
export async function purgeRecycleBin(): Promise<number> {
  const rows = await query<{ id: number }>(
    `delete from donors where deleted_at is not null and deleted_at < now() - make_interval(days => $1) returning id`,
    [BIN_DAYS],
  );
  return rows.length;
}
