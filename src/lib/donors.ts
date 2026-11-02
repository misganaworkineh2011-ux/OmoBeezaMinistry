import "server-only";
import { randomBytes } from "node:crypto";
import { queryOne } from "@/lib/db";
import { readGivingNow } from "@/lib/data/giving";
import { normalizePhone, normalizeTelegram } from "@/lib/giving";
import { donorMessage, type DonorForSms } from "@/lib/reminders";
import { sendSms } from "@/lib/sms";
import { connectLink } from "@/lib/telegram";

// Registering a weekly donor, shared by the website form (/api/donors) and
// the Android app (/api/mobile/donors). Registering the same phone number
// again updates the commitment instead of creating a duplicate.

export interface RegisterInput {
  name: unknown;
  phone: unknown;
  email?: unknown;
  amount: unknown;
  day: unknown;
  locale?: unknown;
  notes?: unknown;
  telegram?: unknown;
  source: "website" | "app";
}

export type RegisterResult =
  | { ok: true; donor: DonorForSms; created: boolean; link: string; telegramLink: string }
  | { ok: false; error: "invalid_name" | "invalid_phone" | "invalid_email" | "invalid_amount" | "invalid_day" | "invalid_telegram" | "save_failed"; min?: number };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function registerDonor(input: RegisterInput): Promise<RegisterResult> {
  const giving = await readGivingNow();
  const name = text(input.name, 80);
  const phone = normalizePhone(text(input.phone, 30));
  const email = text(input.email, 200);
  const amount = Math.round(Number(input.amount));
  const day = Math.round(Number(input.day));
  const locale = input.locale === "am" ? "am" : "en";

  if (!name) return { ok: false, error: "invalid_name" };
  if (!phone) return { ok: false, error: "invalid_phone" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "invalid_email" };
  if (!Number.isFinite(amount) || amount < giving.minAmount || amount > 1_000_000) return { ok: false, error: "invalid_amount", min: giving.minAmount };
  if (!(day >= 0 && day <= 6)) return { ok: false, error: "invalid_day" };
  const telegramRaw = text(input.telegram, 60);
  const telegram = telegramRaw ? normalizeTelegram(telegramRaw) : "";
  if (telegram === null) return { ok: false, error: "invalid_telegram" };

  let donor: DonorForSms | null;
  let wasActive = false;
  let created = false;
  try {
    const existing = await queryOne<{ status: string }>("select status from donors where phone = $1", [phone]);
    wasActive = existing?.status === "active";
    created = !existing;
    donor = await queryOne<DonorForSms>(
      `insert into donors (name, phone, email, amount, reminder_day, locale, token, notes, source, telegram_username)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (phone) do update set name = excluded.name,
         telegram_username = case when excluded.telegram_username <> '' then excluded.telegram_username else donors.telegram_username end,
         email = case when excluded.email <> '' then excluded.email else donors.email end,
         notes = case when excluded.notes <> '' then excluded.notes else donors.notes end,
         amount = excluded.amount, reminder_day = excluded.reminder_day, locale = excluded.locale, status = 'active', stopped_at = null
       returning id, name, phone, amount, reminder_day, locale, token, telegram_chat_id`,
      [name, phone, email, amount, day, locale, randomBytes(9).toString("base64url"), text(input.notes, 2000), input.source, telegram],
    );
  } catch (err) {
    console.error("donors: save failed", err);
    return { ok: false, error: "save_failed" };
  }
  if (!donor) return { ok: false, error: "save_failed" };

  // Welcome new (or returning) donors only, not someone updating their amount.
  // A failed SMS doesn't undo the registration; it shows in the SMS log.
  if (giving.welcomeEnabled && !wasActive) {
    await sendSms({ to: donor.phone, message: donorMessage("welcome", donor, giving), kind: "welcome", donorId: donor.id });
  }
  return { ok: true, donor, created, link: giving.yebunaUrl, telegramLink: await connectLink(donor.token) };
}
