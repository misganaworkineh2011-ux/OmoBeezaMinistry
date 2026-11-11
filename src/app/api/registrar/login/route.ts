import { hasDb, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/giving";
import { clientIp, json, limited } from "@/lib/ratelimit";
import { createRegistrarToken } from "@/lib/registrars";

// POST /api/registrar/login { phone, password } → { token, registrar } for the Sub-admin app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  let body: { phone?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "bad_request" });
  }
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const password = typeof body.password === "string" ? body.password : "";
  if (limited(`reg-login:${clientIp(request)}`, 8, 15 * 60_000) || (phone && limited(`reg-login:${phone}`, 8, 15 * 60_000))) {
    return json(429, { error: "rate_limited" });
  }
  const r = phone
    ? await queryOne<{ id: number; name: string; phone: string; target: number; status: string; password_hash: string }>(
        "select id, name, phone, target, status, password_hash from registrars where phone = $1",
        [phone],
      )
    : null;
  // Same answer either way, so phone numbers can't be discovered.
  if (!r || !(await verifyPassword(password, r.password_hash))) return json(401, { error: "invalid_credentials" });
  if (r.status !== "active") return json(403, { error: "paused" });
  const token = await createRegistrarToken(r.id);
  return json(200, { token, registrar: { id: r.id, name: r.name, phone: r.phone, target: r.target } });
}
