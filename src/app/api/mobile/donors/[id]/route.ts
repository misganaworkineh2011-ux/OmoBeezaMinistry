import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { withAppUser } from "@/lib/mobile";
import { APP_DONOR_SELECT, withLinks, type AppDonor } from "@/lib/app-donors";
import { saveDonorRecord, type DonorInput } from "@/lib/donor-save";
import { asFrequency, type DonorStatus } from "@/lib/giving";

// POST (or PATCH) /api/mobile/donors/[id] — edit a donor from the app.
// Body: any of { name, nickname, phone, email, amount, frequency, day,
// monthDay, locale, notes, telegram, status }; fields left out stay as they are.
// Returns { donor } as the list shows it, or { error } with a message to show.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function edit(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withAppUser(request, async () => {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return json(404, { error: "not_found" });
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "bad_request" });
    }
    const current = await queryOne<DonorInput>(
      `select id, name, nickname, phone, email, amount, reminder_day, frequency, month_day, status, locale, notes, telegram_username
       from donors where id = $1 and deleted_at is null`,
      [id],
    );
    if (!current) return json(404, { error: "not_found", message: "This donor was removed (or is in the recycle bin)." });

    const pick = <T,>(key: string, fallback: T): T => (body[key] === undefined || body[key] === null ? fallback : (body[key] as T));
    const status = pick<string>("status", current.status);
    const res = await saveDonorRecord({
      id,
      name: pick("name", current.name),
      nickname: pick("nickname", current.nickname),
      phone: pick("phone", current.phone),
      email: pick("email", current.email),
      amount: Number(pick("amount", current.amount)),
      reminder_day: Number(pick("day", current.reminder_day)),
      frequency: asFrequency(pick("frequency", current.frequency), current.frequency),
      month_day: Number(pick("monthDay", current.month_day)),
      status: (["active", "paused", "stopped"].includes(status) ? status : current.status) as DonorStatus,
      locale: pick("locale", current.locale),
      notes: pick("notes", current.notes),
      telegram_username: pick("telegram", current.telegram_username),
    });
    if (!res.ok) return json(400, { error: "invalid", message: res.error ?? "Not saved." });
    revalidatePath("/admin", "layout");
    const [donor] = await withLinks(await query<AppDonor>(`${APP_DONOR_SELECT} where d.id = $1`, [id]));
    return json(200, { donor });
  });
}

export { edit as POST, edit as PATCH };
