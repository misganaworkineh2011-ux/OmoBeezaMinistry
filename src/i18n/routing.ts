import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "am"],
  defaultLocale: "en",
  // English at "/", Amharic at "/am/...".
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
