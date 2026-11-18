import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines: everything public, except the dashboard, the API, personal
// pages (stop reminders, thank-you) and the payment redirects (/give).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/stop", "/am/stop", "/en/stop", "/thank-you", "/am/thank-you", "/en/thank-you", "/give"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
