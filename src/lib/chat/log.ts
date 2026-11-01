import "server-only";
import { hasDb, query } from "@/lib/db";

// Conversation log for the dashboard (Chatbot → Conversations). Stores what
// visitors asked and what the assistant answered: no IP addresses, cookies or
// names. Logging never blocks or breaks the chat.

export type AnswerFlag = "" | "no_info" | "off_topic";

const MARKERS: [string, AnswerFlag][] = [
  ["[[NO_INFO]]", "no_info"],
  ["[[OFF_TOPIC]]", "off_topic"],
];
/** Characters held back while streaming so a trailing marker never reaches the visitor. */
export const MARKER_HOLDBACK = Math.max(...MARKERS.map(([m]) => m.length));

/** Remove the review markers the model appends; report which one it used. */
export function stripMarkers(text: string): { text: string; flag: AnswerFlag } {
  let flag: AnswerFlag = "";
  let out = text;
  for (const [marker, f] of MARKERS) {
    if (out.includes(marker)) {
      flag = flag || f;
      out = out.split(marker).join("");
    }
  }
  return { text: out.trimEnd(), flag };
}

export function conversationId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : crypto.randomUUID();
}

export async function logExchange(opts: {
  id: string;
  locale: string;
  page: string;
  question: string;
  answer: string;
  flag: AnswerFlag;
}): Promise<void> {
  if (!hasDb()) return;
  try {
    const unanswered = opts.flag === "no_info" ? 1 : 0;
    await query(
      `insert into chat_conversations (id, locale, page, turns, unanswered) values ($1, $2, $3, 1, $4)
       on conflict (id) do update set last_at = now(), turns = chat_conversations.turns + 1,
         unanswered = chat_conversations.unanswered + $4,
         reviewed = case when $4 > 0 then false else chat_conversations.reviewed end`,
      [opts.id, opts.locale, opts.page.slice(0, 200), unanswered],
    );
    await query("insert into chat_messages (conversation_id, role, content) values ($1, 'user', $2)", [opts.id, opts.question]);
    await query("insert into chat_messages (conversation_id, role, content, flag) values ($1, 'assistant', $2, $3)", [
      opts.id,
      opts.answer.slice(0, 8000),
      opts.flag,
    ]);
  } catch (err) {
    console.error("chat: could not log conversation", err);
  }
}
