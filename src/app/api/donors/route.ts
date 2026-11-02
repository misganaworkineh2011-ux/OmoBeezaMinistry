import { randomBytes } from "node:crypto";
import { hasDb, queryOne } from "@/lib/db";
import { clientIp, json, limited } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { normalizePhone } from "@/lib/giving";
import { donorMessage, type DonorForSms } from "@/lib/reminders";
import { sendSms } from "@/lib/sms";

// POST /api/donors — a visitor commits to give weekly in birr (Donations page).
// Registering again with the same phone number updates the commitment. Returns
// the Ye-Buna link so the browser can continue there to give.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  if (limited(`donors:${clientIp(request)}`, 5, 10 * 60_000)) return json(429, { error: "rate_limited" });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "bad_request" });
  }
  const giving = await readGivingNow();
  // Honeypot: real visitors never fill the hidden "website" field.
  if (text(body.website, 100)) return json(200, { ok: true, link: giving.yebunaUrl });

  const name = text(body.name, 80);
  const phone = normalizePhone(text(body.phone, 30));
  const email = text(body.email, 200);
  const amount = Math.round(Number(body.amount));
  const day = Math.round(Number(body.day));
  const locale = body.locale === "am" ? "am" : "en";

  if (!name || !phone || body.consent !== true) return json(400, { error: "invalid" });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "invalid_email" });
  if (!Number.isFinite(amount) || amount < giving.minAmount || amount > 1_000_000) return json(400, { error: "invalid_amount" });
  if (!(day >= 0 && day <= 6)) return json(400, { error: "invalid_day" });

  let donor: DonorForSms | null;
  let wasActive = false;
  try {
    wasActive = Boolean(await queryOne("select 1 from donors where phone = $1 and status = 'active'", [phone]));
    donor = await queryOne<DonorForSms>(
      `insert into donors (name, phone, email, amount, reminder_day, locale, token)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (phone) do update set name = excluded.name, email = case when excluded.email <> '' then excluded.email else donors.email end,
         amount = excluded.amount, reminder_day = excluded.reminder_day, locale = excluded.locale, status = 'active', stopped_at = null
       returning id, name, phone, amount, reminder_day, locale, token`,
      [name, phone, email, amount, day, locale, randomBytes(9).toString("base64url")],
    );
  } catch (err) {
    console.error("donors: save failed", err);
    return json(500, { error: "save_failed" });
  }

  // Welcome new (or returning) donors only, not someone updating their amount.
  if (donor && giving.welcomeEnabled && !wasActive) {
    // A failed SMS shouldn't stop the visitor from giving; it's in the SMS log.
    await sendSms({ to: donor.phone, message: donorMessage("welcome", donor, giving), kind: "welcome", donorId: donor.id });
  }
  return json(200, { ok: true, link: giving.yebunaUrl });
}
