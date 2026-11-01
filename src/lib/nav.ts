// Shared navigation config. `key` maps to the `nav` message namespace.
export interface NavItem {
  key: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "about", href: "/about" },
  { key: "programs", href: "/programs" },
  { key: "involved", href: "/get-involved" },
  { key: "gallery", href: "/gallery" },
  { key: "blog", href: "/blog" },
  { key: "contact", href: "/contact" },
] as const;

export const FOOTER_MINISTRY: readonly NavItem[] = [
  { key: "about", href: "/about" },
  { key: "programs", href: "/programs" },
  { key: "gallery", href: "/gallery" },
  { key: "videos", href: "/videos" },
  { key: "stories", href: "/stories" },
  { key: "blog", href: "/blog" },
];

export const FOOTER_INVOLVE: readonly NavItem[] = [
  { key: "donate", href: "/donations" },
  { key: "involved", href: "/get-involved" },
  { key: "careers", href: "/careers" },
  { key: "faq", href: "/faq" },
  { key: "contact", href: "/contact" },
];

/** Every static page, used by the sitemap. */
export const STATIC_PATHS = [
  "/",
  "/about",
  "/programs",
  "/get-involved",
  "/stories",
  "/gallery",
  "/gallery/luka",
  "/gallery/carnival",
  "/gallery/vision",
  "/videos",
  "/blog",
  "/donations",
  "/careers",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
