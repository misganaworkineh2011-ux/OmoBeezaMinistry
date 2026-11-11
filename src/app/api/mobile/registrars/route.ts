import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json } from "@/lib/ratelimit";
import { withAppUser } from "@/lib/mobile";
import { REGISTRAR_SELECT, registrarInput, type RegistrarRow } from "@/lib/registrars";

// GET  /api/mobile/registrars — the sub-admins, with their targets and progress (admin app).
// POST /api/mobile/registrars { name, phone, password, target } — add a sub-admin.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async () => {
    const registrars = await query<RegistrarRow>(`${REGISTRAR_SELECT} order by r.status = 'active' desc, r.created_at desc`);
    return json(200, { registrars });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAppUser(request, async (user) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "bad_request" });
    }
    const input = registrarInput(body, false);
    if ("error" in input) return json(400, { error: input.error });
    const v = input.value;
    if (await queryOne("select 1 from registrars where phone = $1", [v.phone])) return json(409, { error: "phone_taken" });
    const row = await queryOne<{ id: number }>(
      "insert into registrars (name, phone, password_hash, target, created_by) values ($1, $2, $3, $4, $5) returning id",
      [v.name, v.phone, await hashPassword(v.password!), v.target, user.id],
    );
    const registrar = await queryOne<RegistrarRow>(`${REGISTRAR_SELECT} where r.id = $1`, [row!.id]);
    return json(200, { registrar });
  });
}
