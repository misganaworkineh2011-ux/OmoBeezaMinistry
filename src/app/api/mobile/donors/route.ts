import { query } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { registerDonor } from "@/lib/donors";
import { withAppUser } from "@/lib/mobile";
import { APP_DONOR_SELECT as SELECT, withLinks, type AppDonor } from "@/lib/app-donors";

// GET  /api/mobile/donors?q=&view=all|active&registrar= — donor list for the app.
// POST /api/mobile/donors                           — register a donor from the app.
// (Editing one: POST /api/mobile/donors/[id].)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEWS: Record<string, string> = {
  all: "true",
  active: "d.status = 'active'",
};

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    const url = new URL(request.url);
    const where = VIEWS[url.searchParams.get("view") ?? "all"] ?? VIEWS.all;
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    // ?registrar=ID: only the donors that sub-admin registered.
    const registrar = Number(url.searchParams.get("registrar")) || null;
    const donors = await query<AppDonor>(
      `${SELECT} where ${where} and d.deleted_at is null
         and ($1 = '' or d.name ilike '%' || $1 || '%' or ($2 <> '' and d.phone like '%' || $2 || '%'))
         and ($3::int is null or d.registered_by = $3)
       order by d.created_at desc limit 300`,
      [q, digits, registrar],
    );
    return json(200, { donors: await withLinks(donors) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "bad_request" });
    }
    if (body.consent !== true) return json(400, { error: "consent_required" });
    const res = await registerDonor({
      name: body.name,
      nickname: body.nickname,
      phone: body.phone,
      email: body.email,
      amount: body.amount,
      day: body.day,
      frequency: body.frequency,
      monthDay: body.monthDay,
      locale: body.locale,
      notes: body.notes,
      telegram: body.telegram,
      source: "app",
      requires: "phone",
    });
    if (!res.ok) return json(res.error === "save_failed" ? 500 : 400, { error: res.error, min: res.min });
    const [donor] = await withLinks(await query<AppDonor>(`${SELECT} where d.id = $1`, [res.donor.id]));
    // The app sends the welcome SMS from the ministry phone (and reports it to /api/mobile/sms).
    // welcome_sms stays empty so older apps don't send it at once: it waits for "Send SMS reminders".
    return json(200, { donor, created: res.created, welcome_sms: "", welcome_pending: res.welcomePending });
  });
}
