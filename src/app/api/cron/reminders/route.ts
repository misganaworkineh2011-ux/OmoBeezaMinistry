import { hasDb } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { runReminders } from "@/lib/reminders";

// GET /api/cron/reminders — runs daily (see vercel.json) and texts the weekly
// donors whose reminder day is today. Vercel Cron sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is rejected.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json(401, { error: "unauthorized" });
  if (!hasDb()) return json(503, { error: "not_configured" });
  const run = await runReminders();
  console.log("reminders:", JSON.stringify(run));
  return json(200, { ok: true, ...run });
}
