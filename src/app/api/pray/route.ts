import { hasDb, query } from "@/lib/db";
import { clientIp, json, limited } from "@/lib/ratelimit";

// POST /api/pray { slug } — a visitor commits to pray for a child. Counted
// once per child per visitor per day (by rate limit), shown on the prayer
// wall and in the dashboard.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return json(503, { error: "not_configured" });
  let slug = "";
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? body.slug.slice(0, 80) : "";
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) return json(400, { error: "bad_request" });

  const ip = clientIp(request);
  if (limited(`pray:${ip}`, 40, 60 * 60_000) || limited(`pray:${ip}:${slug}`, 1, 24 * 60 * 60_000)) {
    return json(200, { ok: true, counted: false });
  }

  const rows = await query<{ prayers: number }>(
    "update children set prayers = prayers + 1 where slug = $1 returning prayers",
    [slug],
  );
  if (rows.length === 0) return json(404, { error: "not_found" });
  await query("insert into prayer_log (child_slug) values ($1)", [slug]);
  return json(200, { ok: true, counted: true, prayers: rows[0].prayers });
}
