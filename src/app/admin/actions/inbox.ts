"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type SubmissionStatus = "new" | "read" | "archived";
const STATUSES: SubmissionStatus[] = ["new", "read", "archived"];

export async function setStatus(ids: number[], status: SubmissionStatus): Promise<void> {
  await requireUser();
  if (!STATUSES.includes(status) || ids.length === 0) return;
  await query("update submissions set status = $1 where id = any($2::int[])", [status, ids]);
  revalidatePath("/admin", "layout");
}

export async function deleteSubmission(id: number): Promise<void> {
  await requireUser();
  await query("delete from submissions where id = $1", [id]);
  revalidatePath("/admin", "layout");
}
