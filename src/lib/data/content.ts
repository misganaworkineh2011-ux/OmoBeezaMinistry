import "server-only";
import { query, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";

export type Messages = Record<string, unknown>;

const readOverrides = cached(
  async (locale: string): Promise<Messages> => {
    const rows = await query<{ ns: string; data: unknown }>("select ns, data from content where locale = $1", [locale]);
    return Object.fromEntries(rows.map((r) => [r.ns, r.data]));
  },
  "content-overrides",
  ["content"],
);

/** Text edited in the dashboard, by message namespace, for one locale. */
export function getContentOverrides(locale: string): Promise<Messages> {
  return safeRead(() => readOverrides(locale), {});
}
