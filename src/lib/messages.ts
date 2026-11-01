import en from "../../messages/en.json";
import am from "../../messages/am.json";

export type Messages = Record<string, unknown>;

export const FILE_MESSAGES: Record<string, Messages> = { en: en as Messages, am: am as Messages };

export function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Deep-merges `override` onto `base`. Arrays and strings are replaced whole, so
// a translated list always wins over the English one. Keys missing from a
// translation fall back to English instead of breaking the page.
export function mergeMessages(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] = isPlainObject(existing) && isPlainObject(value) ? mergeMessages(existing, value) : value;
  }
  return result;
}

/**
 * The text a locale actually shows: English file → English edits →
 * (for Amharic) Amharic file → Amharic edits.
 */
export function effectiveMessages(locale: string, overrides: Record<string, Messages>): Messages {
  let messages = mergeMessages(FILE_MESSAGES.en, overrides.en ?? {});
  if (locale !== "en") {
    messages = mergeMessages(messages, FILE_MESSAGES[locale] ?? {});
    messages = mergeMessages(messages, overrides[locale] ?? {});
  }
  return messages;
}
