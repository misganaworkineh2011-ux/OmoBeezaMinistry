"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDocumentText } from "@/app/admin/actions/knowledge";

const done = () => revalidatePath("/admin", "layout");

export async function setReviewed(id: string, reviewed: boolean): Promise<void> {
  await requireUser();
  await query("update chat_conversations set reviewed = $1 where id = $2", [reviewed, id]);
  done();
}

export async function deleteConversation(id: string): Promise<void> {
  await requireUser();
  await query("delete from chat_conversations where id = $1", [id]);
  done();
}

export async function deleteOldConversations(days: number): Promise<number> {
  await requireUser();
  const rows = await query<{ id: string }>(
    "delete from chat_conversations where last_at < now() - make_interval(days => $1::int) returning id",
    [Math.max(0, Math.round(days))],
  );
  done();
  return rows.length;
}

/**
 * Teach the assistant: saves the admin's answer to a visitor's question as a
 * knowledge document, marks that question as answered, and marks the
 * conversation reviewed once all its unanswered questions are handled.
 */
export async function addAnswerToKnowledge(
  conversationId: string,
  messageId: number,
  question: string,
  answer: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const q = question.trim();
  const a = answer.trim();
  if (a.length < 20) return { ok: false, error: "Write a fuller answer (at least a sentence)." };
  const title = `Q&A: ${q.replace(/\s+/g, " ").slice(0, 90)}${q.length > 90 ? "…" : ""}`;
  const res = await addDocumentText(title, `Question: ${q}\n\nAnswer: ${a}`);
  if (!res.ok) return { ok: false, error: res.error };
  await query("update chat_messages set resolved = true where id = $1 and conversation_id = $2", [messageId, conversationId]);
  // The conversation is done once none of its unanswered questions are left.
  await query(
    `update chat_conversations c set reviewed = not exists (
       select 1 from chat_messages m where m.conversation_id = c.id and m.flag = 'no_info' and not m.resolved)
     where c.id = $1`,
    [conversationId],
  );
  done();
  return { ok: true };
}
