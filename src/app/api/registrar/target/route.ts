import { json } from "@/lib/ratelimit";
import { extendTarget, withRegistrar } from "@/lib/registrars";

// POST /api/registrar/target { add } — a sub-admin who reached their target
// raises it themselves to register more donors (1–500 more at a time).
//   200 { target, registered }   409 { error: "target_not_reached" }   400 { error: "invalid_target" }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRegistrar(request, async (r) => {
    let body: { add?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json(400, { error: "bad_request" });
    }
    const res = await extendTarget(r.id, body.add);
    if (!res.ok) return json(res.error === "target_not_reached" ? 409 : res.error === "not_found" ? 401 : 400, { error: res.error });
    return json(200, { target: res.target, registered: res.registered });
  });
}
