import { json } from "@/lib/ratelimit";
import { revokeRegistrarToken } from "@/lib/registrars";

// POST /api/registrar/logout — ends this phone's sub-admin session.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  await revokeRegistrarToken(request);
  return json(200, { ok: true });
}
