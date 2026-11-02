"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { readGivingNow } from "@/lib/data/giving";
import { DEFAULT_GIVING, DONOR_STATUSES, normalizePhone, type DonorStatus, type GivingSettings } from "@/lib/giving";
import { donorMessage, runReminders, type DonorForSms, type ReminderRun } from "@/lib/reminders";
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

  const clash = await queryOne<{ id: number }>("select id from donors where phone = $1 and id <> $2", [phone, input.id ?? 0]);
  if (clash) return { ok: false, error: "Another donor already has this phone number.", id: clash.id };

  const values = [name, phone, email, amount, day, status, input.locale === "am" ? "am" : "en", s(input.notes, 2000)];
  if (input.id) {
    await query(
      `update donors set name=$1, phone=$2, email=$3, amount=$4, reminder_day=$5, status=$6, locale=$7, notes=$8,
         stopped_at = case when $6 = 'stopped' then coalesce(stopped_at, now()) else null end
       where id=$9`,
      [...values, input.id],
    );
    done();
    return { ok: true, id: input.id };
  }
  const row = await queryOne<{ id: number }>(
    `insert into donors (name, phone, email, amount, reminder_day, status, locale, notes, token, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin') returning id`,
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
  const amounts = [...new Set((input.amounts ?? []).map((n) => Math.round(Number(n))).filter((n) => n > 0))].sort((a, b) => a - b).slice(0, 6);
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
