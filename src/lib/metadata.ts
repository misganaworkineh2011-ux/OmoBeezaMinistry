import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";

export type PageKey =
  | "home"
  | "about"
  | "programs"
  | "involved"
  | "stories"
  | "gallery"
  | "videos"
  | "blog"
  | "careers"
  | "donations"
  | "thanks"
  | "contact"
  | "faq"
  | "privacy"
  | "terms";

/** Locale-aware path: English is unprefixed, other locales get `/<locale>`. */
export function localizedPath(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** hreflang links for every language, plus x-default (English) for everyone else. */
function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((l) => [l, localizedPath(l, path)])),
    "x-default": localizedPath(routing.defaultLocale, path),
  };
}

/** The share image (1200×630, public/og) for each page. */
const PAGE_IMAGES: Partial<Record<PageKey, string>> = {
  home: "/og/home.jpg",
  about: "/og/about.jpg",
  programs: "/og/programs.jpg",
  donations: "/og/donations.jpg",
  thanks: "/og/donations.jpg",
  involved: "/og/donations.jpg",
  gallery: "/og/gallery.jpg",
  videos: "/og/gallery.jpg",
  stories: "/og/stories.jpg",
  blog: "/og/stories.jpg",
};

/** Builds title/description/OG/alternates for a page from the `meta` messages. */
export async function pageMetadata(locale: string, key: PageKey, path: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t(`${key}.title`);
  const description = t(`${key}.description`);
  return buildMetadata({ locale, title, description, path, image: PAGE_IMAGES[key], absoluteTitle: key === "home" });
}

export function buildMetadata({
  locale,
  title,
  description,
  path,
  image = "/og/home.jpg",
  absoluteTitle = false,
  type = "website",
}: {
  locale: string;
  title: string;
  description: string;
  path: string;
  image?: string;
  absoluteTitle?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = localizedPath(locale, path);
  // Share images made for it are 1200×630; other photos (blog covers) are sent as they are.
  const og = image.startsWith("/og/") ? { url: image, width: 1200, height: 630, alt: title } : { url: image, alt: title };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: locale === "am" ? "am_ET" : "en_US",
      alternateLocale: locale === "am" ? ["en_US"] : ["am_ET"],
      type,
      images: [og],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
