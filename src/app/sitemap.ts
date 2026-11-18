import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { listPosts } from "@/lib/blog";
import { localizedPath } from "@/lib/metadata";
import { STATIC_PATHS } from "@/lib/nav";
import { SITE_URL } from "@/lib/site";

// One entry per page and language (English and Amharic), each listing all
// its language versions, so Google indexes both. Blog posts carry their date.
const IMAGES: Record<string, string[]> = {
  "/": ["/og/home.jpg", "/img/photos/group.jpg"],
  "/about": ["/og/about.jpg", "/img/photos/family.jpg"],
  "/programs": ["/og/programs.jpg", "/img/photos/classroom.jpg"],
  "/donations": ["/og/donations.jpg"],
  "/gallery": ["/og/gallery.jpg"],
  "/stories": ["/og/stories.jpg"],
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPosts(routing.defaultLocale).catch(() => []);
  const now = new Date();
  const pages: { path: string; modified: Date; priority: number; freq: "weekly" | "monthly" | "yearly"; images?: string[] }[] = [
    ...STATIC_PATHS.map((path) => ({
      path,
      modified: now,
      priority: path === "/" ? 1 : path === "/donations" ? 0.9 : path === "/privacy" || path === "/terms" ? 0.3 : 0.7,
      freq: (path === "/privacy" || path === "/terms" ? "yearly" : "weekly") as "weekly" | "yearly",
      images: IMAGES[path],
    })),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, modified: new Date(p.date), priority: 0.6, freq: "monthly" as const, images: p.cover ? [p.cover] : undefined })),
  ];

  return pages.flatMap((page) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${localizedPath(locale, page.path)}`,
      lastModified: Number.isNaN(page.modified.getTime()) ? now : page.modified,
      changeFrequency: page.freq,
      priority: locale === routing.defaultLocale ? page.priority : Math.round(page.priority * 0.9 * 10) / 10,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${localizedPath(l, page.path)}`])),
      },
      ...(page.images ? { images: page.images.map((i) => (i.startsWith("http") ? i : `${SITE_URL}${i}`)) } : {}),
    })),
  );
}
