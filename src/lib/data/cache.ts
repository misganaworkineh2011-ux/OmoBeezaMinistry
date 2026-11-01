import "server-only";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

// Cache tags for dashboard-editable data. Public pages read through
// `cached()`; dashboard saves call `refresh()` so changes go live at once.
export type DataTag =
  | "settings"
  | "content"
  | "posts"
  | "children"
  | "albums"
  | "videos"
  | "knowledge";

export function cached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: DataTag[]) {
  return unstable_cache(fn, [key], { tags, revalidate: 3600 });
}

/** Invalidate cached data and re-render every public page. */
export function refresh(...tags: DataTag[]): void {
  for (const tag of tags) revalidateTag(tag);
  revalidatePath("/", "layout");
}
