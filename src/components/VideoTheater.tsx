"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "lenis/react";
import type { Video } from "@/lib/videos";
import Icon from "@/components/Icon";

interface VideoTheaterProps {
  video: Video | null;
  title?: string;
  tag?: string;
  closeLabel: string;
  onClose: () => void;
}

// Full-screen "cinema" player: dims the page, plays the full video with sound,
// closes on Escape / backdrop click and returns focus to what opened it.
export default function VideoTheater({ video, title, tag, closeLabel, onClose }: VideoTheaterProps) {
  const lenis = useLenis();
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const open = video !== null;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    closeRef.current?.focus();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, lenis, onClose]);

  if (!video) return null;
  // Rendered at <body> level: a transformed ancestor (e.g. a scroll-reveal
  // wrapper) would otherwise trap position: fixed inside it.
  return createPortal(
    <div className="theater" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <button ref={closeRef} type="button" className="lightbox__btn lightbox__close" aria-label={closeLabel} onClick={onClose}>
        <Icon name="close" />
      </button>
      <figure
        className="theater__stage"
        style={{ aspectRatio: `${video.w} / ${video.h}`, ["--ratio" as string]: video.w / video.h }}
        onClick={(e) => e.stopPropagation()}
      >
        <video src={video.src} poster={video.poster} controls autoPlay playsInline preload="auto" />
      </figure>
      {title ? (
        <p className="theater__caption" onClick={(e) => e.stopPropagation()}>
          {tag ? <span>{tag}</span> : null}
          {title}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
