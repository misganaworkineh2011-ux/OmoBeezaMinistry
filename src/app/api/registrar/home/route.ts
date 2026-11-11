import { query, queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { publicOrigin } from "@/lib/origin";
import { withRegistrar } from "@/lib/registrars";

// GET /api/registrar/home — the signed-in sub-admin, their target and
// progress, the settings the register form needs, and the donors they
// registered (only theirs).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRegistrar(request, async (r) => {
    const [giving, count, donors] = await Promise.all([
      readGivingNow(),
      queryOne<{ registered: number; today: number }>(
        `select count(*)::int as registered, count(*) filter (where created_at > now() - interval '24 hours')::int as today
         from donors where registered_by = $1`,
        [r.id],
      ),
      query(
        `select id, name, nickname, phone, email, amount, reminder_day, locale, status, source, '' as notes, created_at,
                null as last_reminded_at, null as last_paid, 0 as total
         from donors where registered_by = $1 order by created_at desc limit 500`,
        [r.id],
      ),
    ]);
    return json(200, {
      registrar: { id: r.id, name: r.name, phone: r.phone, target: r.target, registered: count?.registered ?? 0, today: count?.today ?? 0 },
      settings: {
        amounts: giving.amounts,
        minAmount: giving.minAmount,
        defaultDay: giving.defaultDay,
        yebunaUrl: giving.yebunaUrl,
        amountLinks: giving.amountLinks,
        linkBase: `${publicOrigin()}/give`,
      },
      donors,
    });
  });
}
