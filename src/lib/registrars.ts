import "server-only";
import { randomBytes } from "node:crypto";
import { hasDb, query, queryOne } from "@/lib/db";
import { tokenHash } from "@/lib/auth";
import { normalizePhone } from "@/lib/giving";
import { json } from "@/lib/ratelimit";

// Sub-admins ("registrars"): people who only register donors, in the
// "Omo Beeza Sub-admin" app. An admin adds them (Omo Beeza Admin app →
// Sub-admins) with a phone number, a password and the number of donors they
// are asked to register. They have no dashboard access: their tokens
// ("reg_…") live in their own table and only open /api/registrar/….

const SESSION_DAYS = 180;

export interface Registrar {
  id: number;
  name: string;
  phone: string;
  target: number;
  status: string;
}

/** A registrar with how many donors they have registered so far. */
export interface RegistrarRow extends Registrar {
  registered: number;
  created_at: string;
  last_login: string | null;
  last_registered: string | null;
}

export const REGISTRAR_SELECT = `select r.id, r.name, r.phone, r.target, r.status, r.created_at, r.last_login,
  (select count(*)::int from donors d where d.registered_by = r.id) as registered,
  (select max(d.created_at) from donors d where d.registered_by = r.id) as last_registered
  from registrars r`;

/** Sub-admin passwords: at least 8 characters. Returns an error code, or null. */
export function registrarPasswordProblem(password: string): string | null {
  return password.length >= 8 && password.length <= 200 ? null : "weak_password";
}

export async function createRegistrarToken(registrarId: number): Promise<string> {
  const token = `reg_${randomBytes(32).toString("base64url")}`;
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query("insert into registrar_sessions (id, registrar_id, expires_at) values ($1, $2, $3)", [tokenHash(token), registrarId, expires]);
  await query("update registrars set last_login = now() where id = $1", [registrarId]);
  await query("delete from registrar_sessions where expires_at < now()");
  return token;
}

function bearer(request: Request): string | null {
  const m = (request.headers.get("authorization") ?? "").match(/^Bearer (reg_[A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

/** Signs the sub-admin out everywhere (after a password change, pause or removal). */
export async function endRegistrarSessions(registrarId: number): Promise<void> {
  await query("delete from registrar_sessions where registrar_id = $1", [registrarId]);
}

export async function revokeRegistrarToken(request: Request): Promise<void> {
  const token = bearer(request);
  if (token) await query("delete from registrar_sessions where id = $1", [tokenHash(token)]);
}

/** Runs `handler` for a signed-in, active sub-admin, or answers 401. */
export async function withRegistrar(request: Request, handler: (r: Registrar) => Promise<Response>): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  const token = bearer(request);
  const registrar = token
    ? await queryOne<Registrar>(
        `select r.id, r.name, r.phone, r.target, r.status from registrar_sessions s join registrars r on r.id = s.registrar_id
         where s.id = $1 and s.expires_at > now() and r.status = 'active'`,
        [tokenHash(token)],
      )
    : null;
  if (!registrar) return json(401, { error: "unauthorized" });
  return handler(registrar);
}

/** Reads and checks the editable fields; `partial` allows leaving any of them out. */
export function registrarInput(body: Record<string, unknown>, partial: boolean) {
  const out: { name?: string; phone?: string; password?: string; target?: number; status?: string } = {};
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!name) return { error: "invalid_name" } as const;
    out.name = name;
  }
  if (body.phone !== undefined || !partial) {
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    if (!phone) return { error: "invalid_phone" } as const;
    out.phone = phone;
  }
  if ((body.password !== undefined && body.password !== "") || !partial) {
    const password = typeof body.password === "string" ? body.password : "";
    if (registrarPasswordProblem(password)) return { error: "weak_password" } as const;
    out.password = password;
  }
  if (body.target !== undefined || !partial) {
    const target = Math.round(Number(body.target));
    if (!Number.isFinite(target) || target < 0 || target > 100_000) return { error: "invalid_target" } as const;
    out.target = target;
  }
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "paused") return { error: "bad_request" } as const;
    out.status = body.status;
  }
  return { value: out } as const;
}
