import { hasDb } from "@/lib/db";
import { clientIp, json, limited } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { registerDonor } from "@/lib/donors";

// POST /api/donors — a visitor commits to give weekly in birr (Donations page).
// Registering again with the same phone number updates the commitment. Returns
// the Ye-Buna link so the browser can continue there to give.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  if (limited(`donors:${clientIp(request)}`, 5, 10 * 60_000)) return json(429, { error: "rate_limited" });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "bad_request" });
  }
  // Honeypot: real visitors never fill the hidden "website" field.
  if (typeof body.website === "string" && body.website.trim()) {
    return json(200, { ok: true, link: (await readGivingNow()).yebunaUrl });
  }
  if (body.consent !== true) return json(400, { error: "invalid" });

  const res = await registerDonor({
    name: body.name,
    phone: body.phone,
    email: body.email,
    amount: body.amount,
    day: body.day,
    locale: body.locale,
    telegram: body.telegram,
    source: "website",
  });
  if (!res.ok) return json(res.error === "save_failed" ? 500 : 400, { error: res.error });
  // The personal Telegram link connects this donor to the reminder bot in one tap.
  return json(200, { ok: true, link: res.link, telegram: res.telegramLink ? res.donor.token : "" });
}
