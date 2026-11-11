import { queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { registerDonor } from "@/lib/donors";
import { withRegistrar } from "@/lib/registrars";

// POST /api/registrar/donors — a sub-admin registers a new donor. It counts
// toward their target. A phone number that is already registered is refused
// (sub-admins can't change existing donors).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRegistrar(request, async (r) => {
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
      source: "registrar",
      requires: "phone",
      registeredBy: r.id,
      noUpdate: true,
    });
    if (!res.ok) {
      const status = res.error === "save_failed" ? 500 : res.error === "already_registered" ? 409 : 400;
      return json(status, { error: res.error, min: res.min });
    }
    const donor = await queryOne(
      `select id, name, nickname, phone, email, amount, reminder_day, locale, status, source, notes, created_at,
              null as last_reminded_at, null as last_paid, 0 as total
       from donors where id = $1`,
      [res.donor.id],
    );
    const count = await queryOne<{ n: number }>("select count(*)::int as n from donors where registered_by = $1", [r.id]);
    return json(200, { donor, created: true, registered: count?.n ?? 0, target: r.target, link: res.link });
  });
}
