"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db";

/** Stops a donor's weekly SMS reminders (from the personal link in each SMS). */
export async function stopReminders(locale: string, token: string): Promise<void> {
  if (/^[A-Za-z0-9_-]{8,40}$/.test(token)) {
    await query("update donors set status = 'stopped', stopped_at = now() where token = $1 and status <> 'stopped'", [token]);
  }
  redirect(`${locale === "am" ? "/am" : ""}/stop/${token}?done=1`);
}
