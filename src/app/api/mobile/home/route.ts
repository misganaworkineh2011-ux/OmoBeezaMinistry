import { queryOne } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { readGivingNow } from "@/lib/data/giving";
import { withAppUser } from "@/lib/mobile";
import { botUsername } from "@/lib/telegram";

// GET /api/mobile/home — who is signed in, the giving settings the register
// form needs, and the numbers for the app's home screen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAppUser(request, async (user) => {
    const [giving, stats, bot] = await Promise.all([
      readGivingNow(),
      queryOne<{ active: number; weekly: number; paid7: number; pendingAfro: number; today: number }>(
        `select (select count(*)::int from donors where status = 'active') as active,
                (select coalesce(sum(amount), 0)::int from donors where status = 'active') as weekly,
                (select count(distinct donor_id)::int from donor_payments where paid_on > current_date - 7) as paid7,
                (select count(*)::int from donors where status = 'active' and afro_contact_at is null) as "pendingAfro",
                (select count(*)::int from donors where created_at > now() - interval '24 hours') as today`,
      ),
      botUsername(),
    ]);
    return json(200, {
      user,
      settings: { amounts: giving.amounts, minAmount: giving.minAmount, defaultDay: giving.defaultDay, yebunaUrl: giving.yebunaUrl, telegramBot: bot },
      stats,
    });
  });
}
