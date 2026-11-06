import "server-only";
import { cache } from "react";
import { queryOne, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";
import { DEFAULT_GIVING, type GivingSettings } from "@/lib/giving";

// Only the saved values are cached; the defaults are added on every read, so
// settings added in a newer version (e.g. the per-amount Ye-Buna links) are
// never missing because of a value cached by an older deployment.
const readSaved = cached(
  async (): Promise<Partial<GivingSettings>> => {
    const row = await queryOne<{ data: Partial<GivingSettings> }>("select data from settings where key = 'giving'");
    return row?.data ?? {};
  },
  "giving-settings-saved",
  ["settings"],
);

const readGiving = async (): Promise<GivingSettings> => ({ ...DEFAULT_GIVING, ...(await readSaved()) });

/** Weekly giving settings: Ye-Buna link, amounts, SMS templates (dashboard-editable). */
export const getGiving = cache(() => safeRead(readGiving, DEFAULT_GIVING));

/** Read fresh (no cache), for the reminder job and admin actions. */
export async function readGivingNow(): Promise<GivingSettings> {
  const row = await queryOne<{ data: Partial<GivingSettings> }>("select data from settings where key = 'giving'");
  return { ...DEFAULT_GIVING, ...(row?.data ?? {}) };
}
