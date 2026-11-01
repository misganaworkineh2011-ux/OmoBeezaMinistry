"use client";

import { createContext, use, type ReactNode } from "react";
import { DEFAULT_SITE, type SiteSettings } from "@/lib/site";

// Makes the dashboard-editable site settings (email, phones, socials, bank…)
// available to client components. Server components call getSite() instead.
const SiteContext = createContext<SiteSettings>(DEFAULT_SITE);

export function SiteProvider({ site, children }: { site: SiteSettings; children: ReactNode }) {
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteSettings {
  return use(SiteContext);
}
