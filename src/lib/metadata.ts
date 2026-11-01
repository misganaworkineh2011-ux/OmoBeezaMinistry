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
  | "contact"
  | "faq"
  | "privacy"
  | "terms";

/** Locale-aware path: English is unprefixed, other locales get `/<locale>`. */
export function localizedPath(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function languageAlternates(path: string): Record<string, string> {
  return Object.fromEntries(routing.locales.map((l) => [l, localizedPath(l, path)]));
}

/** Builds title/description/OG/alternates for a page from the `meta` messages. */
export async function pageMetadata(locale: string, key: PageKey, path: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t(`${key}.title`);
  const description = t(`${key}.description`);
  return buildMetadata({ locale, title, description, path, absoluteTitle: key === "home" });
}

export function buildMetadata({
  locale,
  title,
  description,
  path,
  image = "/img/photos/group.jpg",
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
      type,
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
