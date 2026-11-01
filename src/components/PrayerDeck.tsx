"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { LukaChild } from "@/lib/galleries";
import Icon from "@/components/Icon";

interface PrayerDeckProps {
  items: LukaChild[];
}

const AUTOPLAY_MS = 3200;
const VISIBLE = 3; // cards shown on each side of the center

/** Shortest signed distance from `active` to `i` around a ring of `n` cards. */
function ringOffset(i: number, active: number, n: number): number {
  let d = (i - active) % n;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

// A fanned deck of every child's polaroid that slowly turns: the centered
// child is named with a "Pray for…" link; side cards can be clicked, the deck
// can be swiped or driven with the arrow keys, and autoplay pauses on hover.
export default function PrayerDeck({ items }: PrayerDeckProps) {
  const t = useTranslations("gallery.luka");
  const tc = useTranslations("common");
  const n = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const go = useCallback((delta: number) => setActive((a) => (a + delta + n) % n), [n]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Autoplay, paused while hovered/focused, when paused by the user, or reduced motion.
  useEffect(() => {
    if (paused || hovering || reduced || n < 2) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, hovering, reduced, n, go]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      go(1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      go(-1);
      e.preventDefault();
    }
  };

  // Swipe / drag: one card per ~60px of travel.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 60) {
      go(dx < 0 ? 1 : -1);
      drag.current = { x: e.clientX, moved: true };
    }
  };
  const endDrag = () => {
    window.setTimeout(() => (drag.current = null), 0);
  };

  if (n === 0) return null;
  const current = items[active];

  return (
    <div
      className="deck"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div
        className="deck__stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={t("prayFor", { name: current.name })}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {items.map((child, i) => {
          const offset = ringOffset(i, active, n);
          const distance = Math.abs(offset);
          const hidden = distance > VISIBLE;
          return (
            <button
              key={child.slug}
              type="button"
              className={`deck__card${offset === 0 ? " is-active" : ""}`}
              style={{
                ["--o" as string]: offset,
                ["--d" as string]: distance,
                zIndex: 50 - distance,
                opacity: hidden ? 0 : 1,
                pointerEvents: hidden ? "none" : undefined,
              }}
              tabIndex={-1}
              aria-hidden={offset !== 0}
              onClick={() => {
                if (drag.current?.moved) return;
                if (offset !== 0) setActive(i);
              }}
            >
              <span className="deck__photo">
                <Image src={child.portrait.src} alt="" fill sizes="240px" draggable={false} />
              </span>
              <span className="deck__name">{child.name}</span>
            </button>
          );
        })}
      </div>

      <div className="deck__controls">
        <button type="button" className="deck__arrow" onClick={() => go(-1)} aria-label={tc("previous")}>
          <Icon name="arrowLeft" />
        </button>

        <div className="deck__now" aria-live="polite">
          <span className="deck__count">
            <strong>{String(active + 1).padStart(2, "0")}</strong> / {String(n).padStart(2, "0")}
          </span>
          <Link href={`/gallery/luka#child-${current.slug}`} className="btn btn--gold">
            <Icon name="handHeart" /> {t("prayFor", { name: current.name })}
          </Link>
        </div>

        <button type="button" className="deck__arrow" onClick={() => go(1)} aria-label={tc("next")}>
          <Icon name="arrowRight" />
        </button>
      </div>

      {/* Progress: one tick per child; the current one stretches while autoplay runs. */}
      <div className="deck__ticks" role="tablist" aria-label={t("eyebrow")}>
        {items.map((child, i) => (
          <button
            key={child.slug}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={child.name}
            className={`deck__tick${i === active ? " is-active" : ""}${
              i === active && !paused && !hovering && !reduced ? " is-running" : ""
            }`}
            style={{ ["--ms" as string]: `${AUTOPLAY_MS}ms` }}
            onClick={() => setActive(i)}
          >
            <span key={i === active ? active : undefined} />
          </button>
        ))}
        <button
          type="button"
          className="deck__pause"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? tc("play") : tc("pause")}
        >
          <Icon name={paused ? "play" : "pause"} fill={paused ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
