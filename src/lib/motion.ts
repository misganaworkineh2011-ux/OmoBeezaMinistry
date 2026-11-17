import "server-only";
import { getTranslations } from "next-intl/server";

/**
 * Fills {sheltered} and {kindergarten} in the animated-story texts from the
 * home page statistics (Dashboard → Website text → Home page → stats), so the
 * numbers are edited in one place.
 */
export async function motionFill(): Promise<(text: string) => string> {
  const stats = (await getTranslations("home")).raw("stats") as { value: number }[];
  return (text: string) =>
    text.replaceAll("{sheltered}", String(stats[0]?.value ?? "")).replaceAll("{kindergarten}", String(stats[1]?.value ?? ""));
}
