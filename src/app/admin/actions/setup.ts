"use server";

import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { importBundledContent } from "@/lib/admin/import";

/** Dashboard "Import existing website content" button. */
export async function importExistingContent(): Promise<{ imported: string[] }> {
  await requireUser();
  const imported = await importBundledContent();
  refresh("settings", "children", "albums", "videos", "posts", "knowledge");
  return { imported };
}
