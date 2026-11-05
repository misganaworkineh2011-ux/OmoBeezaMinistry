import { query, queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { withAppUser } from "@/lib/mobile";
import { donorMessage, type DonorForSms } from "@/lib/reminders";

// Reminders sent as ordinary SMS from the ministry's own phone (the Android
// app's "Send SMS reminders" button).
//   GET  /api/mobile/sms                         active donors not reminded in 7 days, with their message
//   POST /api/mobile/sms { id, ok, error?, kind? } the phone reports each send; a sent reminder counts as reminded
//                                                (kind "welcome": the welcome SMS after registering in the app)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_LIMIT = 500;

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    const giving = await readGivingNow();
    const rows = await query<DonorForSms & { last_reminded_at: string | null }>(
      `select d.id, d.name, d.nickname, d.phone, d.amount, d.reminder_day, d.locale, d.token, d.last_reminded_at
       from donors d
       where d.status = 'active' and d.phone <> ''
         and (d.last_reminded_at is null or d.last_reminded_at < now() - interval '7 days')
         and not ($1 and exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - 7))
       order by d.last_reminded_at nulls first, d.id
       limit $2`,
      [giving.skipIfPaid, QUEUE_LIMIT],
    );
    return json(200, {
      skipIfPaid: giving.skipIfPaid,
      donors: rows.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        last_reminded_at: d.last_reminded_at,
        message: donorMessage("reminder", d, giving),
      })),
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
    const donor = await queryOne<DonorForSms>(
      "select id, name, nickname, phone, amount, reminder_day, locale, token from donors where id = $1",
      [id],
    );
    if (!donor) return json(404, { error: "not_found" });
    const kind = body.kind === "welcome" ? "welcome" : "reminder";
    await query(
      "insert into sms_log (donor_id, to_phone, message, kind, status, provider_id, error, channel) values ($1, $2, $3, $4, $5, 'phone', $6, 'sms')",
      [donor.id, donor.phone, donorMessage(kind, donor, giving), kind, body.ok ? "sent" : "failed", body.ok ? "" : String(body.error ?? "").slice(0, 500)],
    );
    if (body.ok && kind === "reminder") await query("update donors set last_reminded_at = now() where id = $1", [donor.id]);
    return json(200, { ok: true });
  });
}
