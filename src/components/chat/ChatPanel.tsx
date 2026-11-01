"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSite } from "@/components/SiteProvider";
import Icon from "@/components/Icon";
import RichText from "@/components/chat/RichText";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

type Status = "idle" | "streaming";
type ErrorKind = "error" | "rateLimited" | "notConfigured" | null;

const STORAGE_KEY = "ob-chat";
const MAX_LEN = 1000;

function load(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Message[]).slice(-30) : [];
  } catch {
    return [];
  }
}

function save(messages: Message[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // Storage unavailable (private mode) — the chat still works for this visit.
  }
}

// The chat window. Loaded on demand (see ChatLauncher) so it adds nothing to
// the page until a visitor opens it.
export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("chat");
  const SITE = useSite();
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ErrorKind>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(load());
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (status === "idle") save(messages);
  }, [messages, status]);

  // Keep the newest message in view while streaming.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status, error]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = useCallback(
    async (question: string, history: Message[]) => {
      const q = question.trim().slice(0, MAX_LEN);
      if (!q || status === "streaming") return;
      setError(null);
      const next: Message[] = [...history, { role: "user", content: q }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setInput("");
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            messages: next.map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setError(res.status === 429 ? "rateLimited" : res.status === 503 ? "notConfigured" : "error");
          setMessages(next); // drop the empty assistant bubble
          return;
        }

        let sources: string[] = [];
        try {
          sources = JSON.parse(decodeURIComponent(res.headers.get("X-Chat-Sources") ?? "[]")) as string[];
        } catch {
          sources = [];
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let answer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          setMessages([...next, { role: "assistant", content: answer }]);
        }
        setMessages([...next, { role: "assistant", content: answer, sources }]);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("error");
          setMessages((prev) => (prev[prev.length - 1]?.content ? prev : next));
        }
      } finally {
        abortRef.current = null;
        setStatus("idle");
        inputRef.current?.focus();
      }
    },
    [locale, status],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input, messages);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(input, messages);
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    void ask(lastUser.content, messages.slice(0, idx));
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    save([]);
    inputRef.current?.focus();
  };

  const suggestions = t.raw("suggestions") as string[];
  const streaming = status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = streaming && last?.role === "assistant" && !last.content;

  return (
    <div className="chat" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <header className="chat__head">
        <span className="chat__avatar" aria-hidden="true">
          <img src="/img/emblem.png" alt="" width={30} height={30} />
        </span>
        <div className="chat__titles">
          <h2 id="chat-title">{t("title")}</h2>
          <p>
            <span className="chat__online" aria-hidden="true" /> {t("subtitle")}
          </p>
        </div>
        {messages.length > 0 ? (
          <button type="button" className="chat__icon-btn" onClick={reset} aria-label={t("reset")} title={t("reset")}>
            <Icon name="repeat" />
          </button>
        ) : null}
        <button type="button" className="chat__icon-btn" onClick={onClose} aria-label={t("close")} title={t("close")}>
          <Icon name="close" />
        </button>
      </header>

      <div className="chat__body" ref={listRef} data-lenis-prevent aria-live="polite" aria-busy={streaming}>
        <div className="chat__msg chat__msg--bot">
          <div className="chat__bubble">
            <p>{t("welcome")}</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="chat__suggest">
            <span>{t("suggestionsLabel")}</span>
            {suggestions.map((s) => (
              <button key={s} type="button" className="chat__chip" onClick={() => void ask(s, messages)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "assistant" && !m.content ? null : (
            <div key={i} className={`chat__msg chat__msg--${m.role === "user" ? "user" : "bot"}`}>
              <span className="sr-only">{m.role === "user" ? t("you") : t("bot")}:</span>
              <div className="chat__bubble">
                {m.role === "assistant" ? <RichText text={m.content} /> : <p>{m.content}</p>}
              </div>
              {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
                <div className="chat__sources">
                  <Icon name="book" /> {t("sources")}: {m.sources.join(" · ")}
                </div>
              ) : null}
            </div>
          ),
        )}

        {waiting ? (
          <div className="chat__msg chat__msg--bot">
            <div className="chat__bubble chat__typing" role="status" aria-label={t("typing")}>
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="chat__error" role="alert">
            <p>
              {t(error)}
              {error === "notConfigured" ? (
                <>
                  {" "}
                  <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                </>
              ) : null}
            </p>
            {error !== "notConfigured" ? (
              <button type="button" className="chat__retry" onClick={retry}>
                <Icon name="repeat" /> {t("retry")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          {t("placeholder")}
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={MAX_LEN}
          placeholder={t("placeholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming ? (
          <button type="button" className="chat__send chat__send--stop" onClick={() => abortRef.current?.abort()} aria-label={t("stop")}>
            <span className="chat__stop-square" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" className="chat__send" disabled={!input.trim()} aria-label={t("send")}>
            <Icon name="send" />
          </button>
        )}
      </form>
      <p className="chat__disclaimer">{t("disclaimer")}</p>
    </div>
  );
}
