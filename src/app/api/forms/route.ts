import { hasDb, query } from "@/lib/db";
import { clientIp, json, limited } from "@/lib/ratelimit";

// POST /api/forms — saves contact, careers, prayer, newsletter and donation
// forms to the dashboard inbox. Returns 503 when there is no database, so the
// browser falls back to opening the visitor's email app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["contact", "careers", "prayer", "newsletter", "donation"]);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  if (limited(`forms:${clientIp(request)}`, 8, 10 * 60_000)) return json(429, { error: "rate_limited" });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "bad_request" });
  }

  const type = text(body.type, 20);
  if (!TYPES.has(type)) return json(400, { error: "bad_request" });

  const fields = Array.isArray(body.fields)
    ? body.fields
        .slice(0, 12)
        .map((f) => (typeof f === "object" && f !== null ? (f as Record<string, unknown>) : {}))
        .map((f) => ({ label: text(f.label, 80), value: text(f.value, 5000) }))
        .filter((f) => f.label && f.value)
    : [];

  const name = text(body.name, 120);
  const email = text(body.email, 200);
  if (type === "newsletter" ? !email : fields.length === 0) return json(400, { error: "bad_request" });

  try {
    await query("insert into submissions (type, name, email, data) values ($1, $2, $3, $4)", [
      type,
      name,
      email,
      JSON.stringify({ subject: text(body.subject, 200), fields, page: text(body.page, 200) }),
    ]);
  } catch (err) {
    console.error("forms: save failed", err);
    return json(500, { error: "save_failed" });
  }
  return json(200, { ok: true });
}
