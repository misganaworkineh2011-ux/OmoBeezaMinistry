"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";

// The chat window's code is only downloaded when a visitor first opens it
// (or hovers the button), keeping every page light.
const loadPanel = () => import("@/components/chat/ChatPanel");
const ChatPanel = dynamic(loadPanel, { ssr: false });

const NUDGE_KEY = "ob-chat-nudged";

export default function ChatLauncher() {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A one-time, gentle hint per visit, a little after the page settles.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(NUDGE_KEY) === "1";
    } catch {
      seen = true;
    }
    if (seen) return;
    const show = window.setTimeout(() => setNudge(true), 9000);
    const hide = window.setTimeout(() => setNudge(false), 17000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  const dismissNudge = () => {
    setNudge(false);
    try {
      sessionStorage.setItem(NUDGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      {nudge && !open ? (
        <div className="chat-nudge" role="status">
          <button type="button" className="chat-nudge__text" onClick={() => (dismissNudge(), setOpen(true))}>
            {t("nudge")}
          </button>
          <button type="button" className="chat-nudge__close" onClick={dismissNudge} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        className={`chat-launcher${open ? " is-open" : ""}`}
        aria-label={open ? t("close") : t("launcher")}
        aria-expanded={open}
        onClick={() => {
          dismissNudge();
          setOpen((o) => !o);
        }}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
      >
        <span className="chat-launcher__icon chat-launcher__icon--chat" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" strokeWidth="2.6" />
          </svg>
        </span>
        <span className="chat-launcher__icon chat-launcher__icon--close" aria-hidden="true">
          <Icon name="close" />
        </span>
        <span className="chat-launcher__label">{t("launcher")}</span>
      </button>

      {open ? <ChatPanel onClose={close} /> : null}
    </>
  );
}
