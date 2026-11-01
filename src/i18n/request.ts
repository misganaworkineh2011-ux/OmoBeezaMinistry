import { getRequestConfig } from "next-intl/server";
import { routing, isLocale } from "./routing";
import { effectiveMessages, type Messages } from "@/lib/messages";
import { getContentOverrides } from "@/lib/data/content";

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` corresponds to the `[locale]` segment.
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  // Text from messages/*.json, with any edits made in the admin dashboard on top.
  const overrides: Record<string, Messages> = { en: await getContentOverrides("en") };
  if (locale !== "en") overrides[locale] = await getContentOverrides(locale);

  return { locale, messages: effectiveMessages(locale, overrides) };
});
