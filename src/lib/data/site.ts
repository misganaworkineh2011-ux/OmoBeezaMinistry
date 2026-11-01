import "server-only";
import { cache } from "react";
import { queryOne, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";
import { DEFAULT_SITE, type SiteSettings } from "@/lib/site";

const readSite = cached(
  async (): Promise<SiteSettings> => {
    const row = await queryOne<{ data: Partial<SiteSettings> }>("select data from settings where key = 'site'");
    return { ...DEFAULT_SITE, ...(row?.data ?? {}) };
  },
  "site-settings",
  ["settings"],
);

/** Contact details, bank and social links (dashboard-editable). */
export const getSite = cache(() => safeRead(readSite, DEFAULT_SITE));
