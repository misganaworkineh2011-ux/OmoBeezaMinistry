import { query, queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { withAppUser } from "@/lib/mobile";
import { donorMessage, type DonorForSms } from "@/lib/reminders";
import { lastDueSql, reminderDueSql } from "@/lib/giving";

// Reminders sent as ordinary SMS from the ministry's own phone (the Android
// app's "Send SMS reminders" button).
//   GET  /api/mobile/sms                         new donors waiting for their welcome SMS, and active donors whose reminder day has come (their weekday for weekly
//                                                donors, their day of the month for monthly ones), with their message
//   POST /api/mobile/sms { id, ok, error?, kind? } the phone reports each send; only a sent one counts
//                                                (a failed one stays in the list for next time)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_LIMIT = 500;

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    const giving = await readGivingNow();
    const rows = await query<DonorForSms & { last_reminded_at: string | null; welcome_pending: boolean }>(
      `select d.id, d.name, d.nickname, d.phone, d.amount, d.reminder_day, d.frequency, d.month_day, d.locale, d.token, d.last_reminded_at,
              ($3 and d.welcome_pending) as welcome_pending
       from donors d
       where d.status = 'active' and d.deleted_at is null and d.phone <> ''
         and (($3 and d.welcome_pending)
           or (${reminderDueSql("d")}
               and not ($1 and exists (select 1 from donor_payments p where p.donor_id = d.id
                        and p.paid_on > ${lastDueSql("d")} - (case when d.frequency = 'monthly' then 25 else 6 end)))))
       order by ($3 and d.welcome_pending) desc, d.last_reminded_at nulls first, d.id
       limit $2`,
      [giving.skipIfPaid, QUEUE_LIMIT, giving.welcomeEnabled],
    );
    return json(200, {
      skipIfPaid: giving.skipIfPaid,
      donors: rows.map((d) => {
        const kind = d.welcome_pending ? "welcome" : "reminder";
        return { id: d.id, name: d.name, phone: d.phone, last_reminded_at: d.last_reminded_at, kind, message: donorMessage(kind, d, giving) };
      }),
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    let body: { id?: unknown; ok?: unknown; error?: unknown; kind?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json(400, { error: "bad_request" });
    }
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0 || typeof body.ok !== "boolean") return json(400, { error: "bad_request" });
    const giving = await readGivingNow();
    const donor = await queryOne<DonorForSms & { welcome_pending: boolean }>(
      "select id, name, nickname, phone, amount, reminder_day, frequency, month_day, locale, token, welcome_pending from donors where id = $1",
      [id],
    );
    if (!donor) return json(404, { error: "not_found" });
    // The queue decides which message a donor got: their welcome while one is
    // waiting, otherwise their reminder (older apps always report "reminder").
    const kind = body.kind === "welcome" || (donor.welcome_pending && giving.welcomeEnabled) ? "welcome" : "reminder";
    await query(
      "insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error, channel) values ($1, $2, $3, $4, $5, 'phone', $6, 'sms')",
      [donor.id, donor.phone, donorMessage(kind, donor, giving), kind, body.ok ? "sent" : "failed", body.ok ? "" : String(body.error ?? "").slice(0, 500)],
    );
    // Only a message the phone confirmed as sent counts. A failed one leaves the
    // donor waiting, so they are in the list again next time.
    if (body.ok) {
      await query(
        kind === "welcome"
          ? "update donors set welcome_pending = false, last_reminded_at = now() where id = $1"
          : "update donors set last_reminded_at = now() where id = $1",
        [donor.id],
      );
    }
    return json(200, { ok: true });
  });
}
