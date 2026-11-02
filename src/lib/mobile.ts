import "server-only";
import { randomBytes } from "node:crypto";
import { hasDb, query, queryOne } from "@/lib/db";
import { tokenHash, type AdminUser } from "@/lib/auth";
import { json } from "@/lib/ratelimit";

// Sign-in for the Android app. The app signs in with a dashboard admin's
// email and password and gets a long-lived token (stored hashed in the same
// sessions table as browser sign-ins), sent as "Authorization: Bearer …".

const APP_SESSION_DAYS = 180;

export async function createAppToken(userId: number): Promise<string> {
  const token = `app_${randomBytes(32).toString("base64url")}`;
  const expires = new Date(Date.now() + APP_SESSION_DAYS * 86_400_000);
  await query("insert into sessions (id, user_id, expires_at) values ($1, $2, $3)", [tokenHash(token), userId, expires]);
  await query("update users set last_login = now() where id = $1", [userId]);
  return token;
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer (app_[A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

export async function appUser(request: Request): Promise<AdminUser | null> {
  const token = bearer(request);
  if (!token || !hasDb()) return null;
  return queryOne<AdminUser>(
    `select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [tokenHash(token)],
  );
}

export async function revokeAppToken(request: Request): Promise<void> {
  const token = bearer(request);
  if (token) await query("delete from sessions where id = $1", [tokenHash(token)]);
}

/** Runs `handler` for a signed-in app user, or answers 401. */
export async function withAppUser(request: Request, handler: (user: AdminUser) => Promise<Response>): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  const user = await appUser(request);
  if (!user) return json(401, { error: "unauthorized" });
  return handler(user);
}
