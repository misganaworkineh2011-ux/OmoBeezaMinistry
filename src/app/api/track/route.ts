import { hasDb, query } from "@/lib/db";
import { clientIp, limited } from "@/lib/ratelimit";

// POST /api/track { path, event } — privacy-friendly analytics. Stores only
// daily counts per page and event: no cookies, no IP addresses, no personal data.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = new Set(["view", "donate_click"]);
const empty = () => new Response(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  if (!hasDb()) return empty();
  if (limited(`track:${clientIp(request)}`, 120, 10 * 60_000)) return empty();

  let path = "";
  let event = "";
  try {
    const body = JSON.parse(await request.text()) as { path?: unknown; event?: unknown };
    path = typeof body.path === "string" ? body.path : "";
    event = typeof body.event === "string" ? body.event : "";
  } catch {
    return empty();
  }
  if (!EVENTS.has(event) || !path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return empty();

  // Normalise: drop query/hash, trailing slash, and cap length.
  const clean = (path.split(/[?#]/)[0] || "/").replace(/(.)\/+$/, "$1").slice(0, 200);
  try {
    await query(
      `insert into analytics (day, path, event, count) values (current_date, $1, $2, 1)
       on conflict (day, path, event) do update set count = analytics.count + 1`,
      [clean, event],
    );
  } catch {
    // Analytics must never break the site.
  }
  return empty();
}
