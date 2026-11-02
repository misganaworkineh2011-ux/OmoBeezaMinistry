import { json } from "@/lib/ratelimit";
import { revokeAppToken } from "@/lib/mobile";

// POST /api/mobile/logout — signs the Android app out (revokes its token).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  await revokeAppToken(request);
  return json(200, { ok: true });
}
