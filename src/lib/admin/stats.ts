import "server-only";
import { query, queryOne } from "@/lib/db";

/** Daily series for the last `days` days (oldest first), filling gaps with 0. */
export async function dailySeries(event: string, days: number): Promise<{ label: string; value: number }[]> {
  const rows = await query<{ day: string | Date; n: number }>(
    `select day, sum(count)::int as n from analytics
     where event = $1 and day > current_date - $2::int group by day`,
    [event, days],
  );
  const byDay = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r.n]));
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: key.slice(5), value: byDay.get(key) ?? 0 });
  }
  return out;
}

export async function total(sql: string, params: unknown[] = []): Promise<number> {
  return (await queryOne<{ n: number }>(sql, params))?.n ?? 0;
}

const LOG_TABLES = new Set(["prayer_log", "chat_logs", "submissions"]);

/** Daily counts of rows in a log table (by created_at) for the last `days` days. */
export async function logSeries(table: "prayer_log" | "chat_logs" | "submissions", days: number): Promise<{ label: string; value: number }[]> {
  if (!LOG_TABLES.has(table)) throw new Error("Unknown table");
  const rows = await query<{ day: string | Date; n: number }>(
    `select (created_at at time zone 'UTC')::date as day, count(*)::int as n from ${table}
     where created_at > now() - make_interval(days => $1::int) group by 1`,
    [days],
  );
  const byDay = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r.n]));
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: key.slice(5), value: byDay.get(key) ?? 0 });
  }
  return out;
}
