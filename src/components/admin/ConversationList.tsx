"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAnswerToKnowledge, deleteConversation, deleteOldConversations, setReviewed } from "@/app/admin/actions/conversations";
import Icon from "@/components/Icon";

export interface TranscriptMessage {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  flag: "" | "no_info" | "off_topic";
  resolved: boolean;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  locale: string;
  page: string;
  started_at: string;
  last_at: string;
  turns: number;
  unanswered: number;
  reviewed: boolean;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const EMPTY: Record<string, string> = {
  review: "Nothing to review. Every question the chatbot couldn’t answer has been handled.",
  unanswered: "No unanswered questions yet.",
  offtopic: "No off-topic questions yet.",
  all: "No conversations yet. They appear here as visitors use the chatbot.",
};

/** Inline form under an unanswered question: the admin's answer becomes chatbot knowledge. */
function Teach({ conversationId, messageId, question }: { conversationId: string; messageId: number; question: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (msg?.ok) {
    return (
      <p className="notice notice--ok convo__teach">
        <Icon name="check" /> {msg.text}
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="a-btn a-btn--gold a-btn--sm convo__teach" onClick={() => setOpen(true)}>
        <Icon name="sparkles" /> Teach the chatbot the answer
      </button>
    );
  }
  return (
    <div className="convo__teach">
      <label className="a-label" htmlFor={`teach-${conversationId}-${question.length}`}>
        Your answer to “{question.length > 120 ? `${question.slice(0, 120)}…` : question}”
      </label>
      <textarea
        id={`teach-${conversationId}-${question.length}`}
        className="a-input"
        rows={4}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write the correct answer in plain words, in any language. The chatbot will translate it for visitors."
      />
      {msg ? <p className="notice notice--error">{msg.text}</p> : null}
      <div className="btn-group" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="a-btn a-btn--gold a-btn--sm"
          disabled={pending || answer.trim().length < 20}
          onClick={() =>
            start(async () => {
              const res = await addAnswerToKnowledge(conversationId, messageId, question, answer);
              setMsg(res.ok ? { ok: true, text: "Added to the chatbot’s knowledge. It will use this answer from now on." } : { ok: false, text: res.error ?? "Not saved." });
              if (res.ok) router.refresh();
            })
          }
        >
          <Icon name="check" /> {pending ? "Saving…" : "Add to knowledge"}
        </button>
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ConversationList({
  rows,
  view,
}: {
  rows: (ConversationRow & { messages: TranscriptMessage[] })[];
  view: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <>
      <div className="form-actions" style={{ marginTop: 0, marginBottom: 12, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="a-btn a-btn--ghost a-btn--sm"
          disabled={pending}
          onClick={() => confirm("Delete all conversations older than 90 days?") && run(() => deleteOldConversations(90))}
        >
          Delete conversations older than 90 days
        </button>
      </div>

      {rows.length === 0 ? <p className="empty">{EMPTY[view] ?? EMPTY.all}</p> : null}

      {rows.map((c) => {
        const first = c.messages.find((m) => m.role === "user")?.content ?? "(no question)";
        const offTopic = c.messages.some((m) => m.flag === "off_topic");
        const needs = c.unanswered > 0 && !c.reviewed;
        return (
          <details key={c.id} className={`inbox-item${needs ? " is-new" : ""}`}>
            <summary>
              {needs ? <span className="pill pill--new">Needs review</span> : null}
              {c.unanswered > 0 && c.reviewed ? <span className="pill pill--ok">Reviewed</span> : null}
              {offTopic ? <span className="pill">Off-topic</span> : null}
              <span className="inbox-item__who">
                <strong dir="auto">{first.length > 140 ? `${first.slice(0, 140)}…` : first}</strong>
                <span>
                  {c.turns} question{c.turns === 1 ? "" : "s"}
                  {c.unanswered ? ` · ${c.unanswered} unanswered` : ""} · site in {c.locale === "am" ? "Amharic" : "English"}
                  {c.page ? ` · from ${c.page}` : ""}
                </span>
              </span>
              <span className="a-hint">{when(c.last_at)}</span>
            </summary>

            <div className="inbox-item__body">
              <div className="convo">
                {c.messages.map((m, i) => {
                  const asked = m.role === "assistant" ? [...c.messages.slice(0, i)].reverse().find((x) => x.role === "user")?.content ?? "" : "";
                  return (
                    <div key={m.id} className={`convo__msg convo__msg--${m.role}`}>
                      <span className="convo__who">
                        {m.role === "user" ? "Visitor" : "Chatbot"}
                        {m.flag === "no_info" ? <span className={`pill ${m.resolved ? "pill--ok" : "pill--new"}`}>Couldn’t answer</span> : null}
                        {m.flag === "off_topic" ? <span className="pill">Off-topic</span> : null}
                      </span>
                      <div className="convo__bubble" dir="auto">
                        {m.content}
                      </div>
                      {m.flag === "no_info" && m.resolved ? (
                        <span className="pill pill--ok convo__teach">
                          <Icon name="check" /> Answer added to knowledge
                        </span>
                      ) : null}
                      {m.flag === "no_info" && !m.resolved ? <Teach conversationId={c.id} messageId={m.id} question={asked} /> : null}
                    </div>
                  );
                })}
              </div>

              <div className="btn-group" style={{ marginTop: 14 }}>
                {c.unanswered > 0 ? (
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => setReviewed(c.id, !c.reviewed))}>
                    <Icon name="check" /> {c.reviewed ? "Mark as needing review" : "Mark as reviewed"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="a-btn a-btn--danger a-btn--sm"
                  disabled={pending}
                  onClick={() => confirm("Delete this conversation?") && run(() => deleteConversation(c.id))}
                >
                  Delete
                </button>
              </div>
            </div>
          </details>
        );
      })}
    </>
  );
}
