import { query } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { registerDonor } from "@/lib/donors";
import { withAppUser } from "@/lib/mobile";
import { botUsername } from "@/lib/telegram";

// GET  /api/mobile/donors?q=&view=all|active&registrar= — donor list for the app.
// POST /api/mobile/donors                           — register a donor from the app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AppDonor {
  id: number;
  name: string;
  nickname: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  locale: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
  last_reminded_at: string | null;
  last_paid: string | null;
  total: number;
  telegram_username: string;
  telegram_linked: boolean;
  /** The sub-admin who registered them ("" = not a sub-admin). */
  registered_by_name: string;
  token?: string;
  telegram_link?: string;
}

/** Adds each donor's one-tap Telegram link (and drops the raw token). */
async function withLinks(donors: AppDonor[]): Promise<AppDonor[]> {
  const bot = await botUsername();
  return donors.map(({ token, ...d }) => ({ ...d, telegram_link: bot && token ? `https://t.me/${bot}?start=${token}` : "" }));
}

const SELECT = `select d.id, d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.locale, d.status, d.source, d.notes,
  d.created_at, d.last_reminded_at, d.telegram_username, d.telegram_chat_id is not null as telegram_linked, d.token,
  coalesce((select r.name from registrars r where r.id = d.registered_by), '') as registered_by_name,
  (select max(p.paid_on)::text from donor_payments p where p.donor_id = d.id) as last_paid,
  (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total
  from donors d`;

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
      `${SELECT} where ${where}
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
      locale: body.locale,
      notes: body.notes,
      telegram: body.telegram,
      source: "app",
      requires: "phone",
    });
    if (!res.ok) return json(res.error === "save_failed" ? 500 : 400, { error: res.error, min: res.min });
    const [donor] = await withLinks(await query<AppDonor>(`${SELECT} where d.id = $1`, [res.donor.id]));
    // The app sends the welcome SMS from the ministry phone (and reports it to /api/mobile/sms).
    return json(200, { donor, created: res.created, welcome_sms: res.welcomeSms });
  });
}
