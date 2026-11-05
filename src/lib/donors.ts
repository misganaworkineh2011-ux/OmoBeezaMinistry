import "server-only";
import { randomBytes } from "node:crypto";
import { queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { isEmail, normalizePhone, normalizeTelegram } from "@/lib/giving";
import { donorMessage, emailDonor, type DonorForSms } from "@/lib/reminders";
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
  day: unknown;
  locale?: unknown;
  notes?: unknown;
  telegram?: unknown;
  source: "website" | "app" | "telegram";
  /** Which contact detail is required: the website asks for email, the app and the bot for a phone number. */
  requires: "email" | "phone";
  /** Skip the welcome email (e.g. the bot welcomes them on Telegram instead). */
  noWelcome?: boolean;
}

export type RegisterResult =
  | {
      ok: true;
      donor: DonorForSms;
      created: boolean;
      link: string;
      telegramLink: string;
      /** For donors with a phone: the welcome SMS for the app to send from the ministry phone ("" = none). */
      welcomeSms: string;
    }
  | { ok: false; error: "invalid_name" | "invalid_phone" | "invalid_email" | "invalid_amount" | "invalid_day" | "invalid_telegram" | "save_failed"; min?: number };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const RETURNING = "id, name, nickname, phone, email, amount, reminder_day, locale, token, telegram_chat_id";

export async function registerDonor(input: RegisterInput): Promise<RegisterResult> {
  const giving = await readGivingNow();
  const name = text(input.name, 80);
  const nickname = text(input.nickname, 40);
  const phoneRaw = text(input.phone, 30);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const email = text(input.email, 200).toLowerCase();
  const amount = Math.round(Number(input.amount));
  const day = Math.round(Number(input.day));
  const locale = input.locale === "am" ? "am" : "en";

  if (!name) return { ok: false, error: "invalid_name" };
  if (phone === null || (input.requires === "phone" && !phone)) return { ok: false, error: "invalid_phone" };
  if ((email && !isEmail(email)) || (input.requires === "email" && !email)) return { ok: false, error: "invalid_email" };
  if (!Number.isFinite(amount) || amount < giving.minAmount || amount > 1_000_000) return { ok: false, error: "invalid_amount", min: giving.minAmount };
  if (!(day >= 0 && day <= 6)) return { ok: false, error: "invalid_day" };
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
      ? await queryOne<{ id: number; status: string }>("select id, status from donors where phone = $1", [phone])
      : await queryOne<{ id: number; status: string }>(
          "select id, status from donors where lower(email) = $1 order by (phone = '') desc, id limit 1",
          [email],
        );
    wasActive = existing?.status === "active";
    created = !existing;
    donor = existing
      ? await queryOne(
          `update donors set name = $1,
             nickname = case when $2 <> '' then $2 else nickname end,
             phone = case when $3 <> '' then $3 else phone end,
             email = case when $4 <> '' then $4 else email end,
             amount = $5, reminder_day = $6, locale = $7,
             notes = case when $8 <> '' then $8 else notes end,
             telegram_username = case when $9 <> '' then $9 else telegram_username end,
             status = 'active', stopped_at = null
           where id = $10 returning ${RETURNING}`,
          [name, nickname, phone, email, amount, day, locale, notes, telegram, existing.id],
        )
      : await queryOne(
          `insert into donors (name, nickname, phone, email, amount, reminder_day, locale, token, notes, source, telegram_username)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning ${RETURNING}`,
          [name, nickname, phone, email, amount, day, locale, randomBytes(9).toString("base64url"), notes, input.source, telegram],
        );
  } catch (err) {
    console.error("donors: save failed", err);
    return { ok: false, error: "save_failed" };
  }
  if (!donor) return { ok: false, error: "save_failed" };

  // Welcome new (or returning) donors only, not someone updating their amount.
  // A failed email doesn't undo the registration; it shows in the message log.
  const welcome = giving.welcomeEnabled && !wasActive && !input.noWelcome;
  if (welcome && donor.email) await emailDonor("welcome", donor, giving);
  return {
    ok: true,
    donor,
    created,
    link: giving.yebunaUrl,
    telegramLink: await connectLink(donor.token),
    welcomeSms: welcome && donor.phone && !donor.email ? donorMessage("welcome", donor, giving) : "",
  };
}
