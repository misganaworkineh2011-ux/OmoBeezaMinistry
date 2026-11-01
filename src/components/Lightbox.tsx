"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLenis } from "lenis/react";
import Icon from "@/components/Icon";

export interface LightboxItem {
  src: string;
  w: number;
  h: number;
  caption?: string;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number | null;
  onChange: (index: number | null) => void;
}

// Full-screen photo viewer: Escape closes, arrow keys navigate, focus is
// returned to whatever opened it, and background scrolling is paused.
export default function Lightbox({ items, index, onChange }: LightboxProps) {
  const t = useTranslations("common");
  const lenis = useLenis();
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const open = index !== null && items[index] !== undefined;
  const count = items.length;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    closeRef.current?.focus();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      lenis?.start();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, lenis]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      if (e.key === "ArrowRight") onChange((index + 1) % count);
      if (e.key === "ArrowLeft") onChange((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onChange]);

  if (!open) return null;
  const current = items[index];
  const label = current.caption ?? `${index + 1} / ${count}`;

  // Rendered at <body> level: a transformed ancestor (e.g. a scroll-reveal
  // wrapper) would otherwise trap position: fixed inside it.
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={() => onChange(null)}>
      <button ref={closeRef} type="button" className="lightbox__btn lightbox__close" aria-label={t("close")} onClick={() => onChange(null)}>
        <Icon name="close" />
      </button>
      {count > 1 ? (
        <>
          <button
            type="button"
            className="lightbox__btn lightbox__prev"
            aria-label={t("previous")}
            onClick={(e) => {
              e.stopPropagation();
              onChange((index - 1 + count) % count);
            }}
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className="lightbox__btn lightbox__next"
            aria-label={t("next")}
            onClick={(e) => {
              e.stopPropagation();
              onChange((index + 1) % count);
            }}
          >
            <Icon name="chevronRight" />
          </button>
        </>
      ) : null}
      <figure onClick={(e) => e.stopPropagation()}>
        <Image key={current.src} src={current.src} alt={current.caption ?? ""} width={current.w} height={current.h} sizes="90vw" />
        <figcaption>
          {current.caption}
          <span className="lightbox__count">
            {index + 1} / {count}
          </span>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
