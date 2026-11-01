import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllSlugs } from "@/lib/blog";
import { localizedPath } from "@/lib/metadata";
import { STATIC_PATHS } from "@/lib/nav";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllSlugs();
  const paths = [...STATIC_PATHS, ...slugs.map((s) => `/blog/${s}`)];

  return paths.map((path) => ({
    url: `${SITE_URL}${localizedPath(routing.defaultLocale, path)}`,
    changeFrequency: path.startsWith("/blog") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path === "/donations" ? 0.9 : 0.7,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${localizedPath(l, path)}`])),
    },
  }));
}
