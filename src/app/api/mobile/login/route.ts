import { hasDb, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { clientIp, json, limited } from "@/lib/ratelimit";
import { createAppToken } from "@/lib/mobile";

// POST /api/mobile/login { email, password } → { token, user } for the Android app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  if (limited(`app-login:${clientIp(request)}`, 8, 15 * 60_000)) return json(429, { error: "rate_limited" });
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "bad_request" });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = await queryOne<{ id: number; name: string; email: string; password_hash: string }>(
    "select id, name, email, password_hash from users where lower(email) = $1",
    [email],
  );
  // Same answer either way, so emails can't be discovered.
  if (!user || !(await verifyPassword(password, user.password_hash))) return json(401, { error: "invalid_credentials" });
  const token = await createAppToken(user.id);
  return json(200, { token, user: { id: user.id, name: user.name, email: user.email } });
}
