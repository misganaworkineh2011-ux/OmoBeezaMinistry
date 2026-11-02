import { queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { withAppUser } from "@/lib/mobile";

// PATCH (or POST) /api/mobile/donors/:id { afroContact: boolean } — the app's guided
// AfroMessage step: marks the donor as added and verified in AfroMessage contacts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withAppUser(request, async () => {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return json(400, { error: "bad_request" });
    let body: { afroContact?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json(400, { error: "bad_request" });
    }
    if (typeof body.afroContact !== "boolean") return json(400, { error: "bad_request" });
    const row = await queryOne<{ id: number; afro_contact_at: string | null }>(
      `update donors set afro_contact_at = case when $1 then coalesce(afro_contact_at, now()) else null end
       where id = $2 returning id, afro_contact_at`,
      [body.afroContact, id],
    );
    if (!row) return json(404, { error: "not_found" });
    return json(200, { ok: true, afro_contact_at: row.afro_contact_at });
  });
}

// Android's HttpURLConnection can't send PATCH, so the app uses POST.
export const POST = PATCH;
