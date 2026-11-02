import "server-only";
import { cache } from "react";
import { queryOne, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";
import { DEFAULT_GIVING, type GivingSettings } from "@/lib/giving";

const readGiving = cached(
  async (): Promise<GivingSettings> => {
    const row = await queryOne<{ data: Partial<GivingSettings> }>("select data from settings where key = 'giving'");
    return { ...DEFAULT_GIVING, ...(row?.data ?? {}) };
  },
  "giving-settings",
  ["settings"],
);

/** Weekly giving settings: Ye-Buna link, amounts, SMS templates (dashboard-editable). */
export const getGiving = cache(() => safeRead(readGiving, DEFAULT_GIVING));

/** Read fresh (no cache), for the reminder job and admin actions. */
export async function readGivingNow(): Promise<GivingSettings> {
  const row = await queryOne<{ data: Partial<GivingSettings> }>("select data from settings where key = 'giving'");
  return { ...DEFAULT_GIVING, ...(row?.data ?? {}) };
}
