import "server-only";
import { SITE_URL } from "@/lib/site";

/** The public address of the site, for links inside reminders. */
export function publicOrigin(): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return SITE_URL;
}
