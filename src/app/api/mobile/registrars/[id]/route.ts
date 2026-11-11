import { queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json } from "@/lib/ratelimit";
import { withAppUser } from "@/lib/mobile";
import { endRegistrarSessions, REGISTRAR_SELECT, registrarInput, type RegistrarRow } from "@/lib/registrars";

// POST/PATCH /api/mobile/registrars/:id { name?, phone?, password?, target?, status? } — edit a sub-admin.
// DELETE      /api/mobile/registrars/:id — remove them (their donors stay, without "registered by").
// (The app sends { delete: true } by POST, as Android's HttpURLConnection can't send PATCH.)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function remove(id: number): Promise<Response> {
  const gone = await queryOne("delete from registrars where id = $1 returning id", [id]);
  return gone ? json(200, { ok: true, deleted: true }) : json(404, { error: "not_found" });
}

async function update(request: Request, ctx: Ctx): Promise<Response> {
  return withAppUser(request, async () => {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) return json(404, { error: "not_found" });
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "bad_request" });
    }
    if (body.delete === true) return remove(id);
    const input = registrarInput(body, true);
    if ("error" in input) return json(400, { error: input.error });
    const v = input.value;
    if (v.phone && (await queryOne("select 1 from registrars where phone = $1 and id <> $2", [v.phone, id]))) {
      return json(409, { error: "phone_taken" });
    }
    const hash = v.password ? await hashPassword(v.password) : null;
    const row = await queryOne<{ id: number }>(
      `update registrars set name = coalesce($2, name), phone = coalesce($3, phone), password_hash = coalesce($4, password_hash),
         target = coalesce($5, target), status = coalesce($6, status)
       where id = $1 returning id`,
      [id, v.name ?? null, v.phone ?? null, hash, v.target ?? null, v.status ?? null],
    );
    if (!row) return json(404, { error: "not_found" });
    // A new password or a pause signs them out of the app.
    if (hash || v.status === "paused") await endRegistrarSessions(id);
    const registrar = await queryOne<RegistrarRow>(`${REGISTRAR_SELECT} where r.id = $1`, [id]);
    return json(200, { registrar });
  });
}

export const POST = update;
export const PATCH = update;

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  return withAppUser(request, async () => {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) return json(404, { error: "not_found" });
    return remove(id);
  });
}
