import { query } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { registerDonor } from "@/lib/donors";
import { withAppUser } from "@/lib/mobile";

// GET  /api/mobile/donors?q=&view=all|active|afro  — donor list for the app.
// POST /api/mobile/donors                           — register a donor from the app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AppDonor {
  id: number;
  name: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  locale: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
  afro_contact_at: string | null;
  last_paid: string | null;
  total: number;
}

const SELECT = `select d.id, d.name, d.phone, d.email, d.amount, d.reminder_day, d.locale, d.status, d.source, d.notes,
  d.created_at, d.afro_contact_at,
  (select max(p.paid_on)::text from donor_payments p where p.donor_id = d.id) as last_paid,
  (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total
  from donors d`;

const VIEWS: Record<string, string> = {
  all: "true",
  active: "d.status = 'active'",
  afro: "d.status = 'active' and d.afro_contact_at is null",
};

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    const url = new URL(request.url);
    const where = VIEWS[url.searchParams.get("view") ?? "all"] ?? VIEWS.all;
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    const donors = await query<AppDonor>(
      `${SELECT} where ${where}
         and ($1 = '' or d.name ilike '%' || $1 || '%' or ($2 <> '' and d.phone like '%' || $2 || '%'))
       order by d.created_at desc limit 300`,
      [q, digits],
    );
    return json(200, { donors });
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
      phone: body.phone,
      email: body.email,
      amount: body.amount,
      day: body.day,
      locale: body.locale,
      notes: body.notes,
      source: "app",
    });
    if (!res.ok) return json(res.error === "save_failed" ? 500 : 400, { error: res.error, min: res.min });
    const [donor] = await query<AppDonor>(`${SELECT} where d.id = $1`, [res.donor.id]);
    return json(200, { donor, created: res.created });
  });
}
