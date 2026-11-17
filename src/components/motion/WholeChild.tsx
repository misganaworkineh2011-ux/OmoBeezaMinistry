"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Icon, { type IconName } from "@/components/Icon";

export interface Pillar {
  title: string;
  descr: string;
  icon: IconName;
}

// Programs page: "growing in every way" (Luke 2:52). The four sides of a
// child's life orbit the child at the centre; one at a time is highlighted
// with its meaning below. Pauses on hover; tap a planet to choose it.
export default function WholeChild({ pillars, center, verse }: { pillars: Pillar[]; center: string; verse: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((a) => (a + 1) % pillars.length), 3200);
    return () => window.clearInterval(timer);
  }, [visible, held, pillars.length]);

  const current = pillars[active];

  return (
    <div ref={ref} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
      <div className="orbit">
        <div className="orbit__rings" aria-hidden="true" />
        <div className="orbit__glow" aria-hidden="true" />
        <div className="orbit__center">
          <div>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="12" r="7" fill="currentColor" />
              <path d="M24 21c-8 0-13 5-13 12v4h26v-4c0-7-5-12-13-12z" fill="currentColor" opacity=".9" />
              <path d="M24 30c-1.6-2.6-6-2.2-6 1.2 0 2.8 4.2 4.8 6 6.4 1.8-1.6 6-3.6 6-6.4 0-3.4-4.4-3.8-6-1.2z" fill="#e2723f" />
            </svg>
            <strong>{center}</strong>
            <small>{verse}</small>
          </div>
        </div>
        <div className="orbit__spin">
          {pillars.map((p, i) => (
            <div key={p.title} className="orbit__planet" style={{ "--a": `${(360 / pillars.length) * i}deg` } as CSSProperties}>
              <div>
                <button type="button" className={i === active ? "is-active" : undefined} onClick={() => setActive(i)} aria-pressed={i === active}>
                  <span className="icon-badge">
                    <Icon name={p.icon} />
                  </span>
                  <span className="orbit__name">{p.title}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="orbit__info" aria-live="polite">
        <strong>{current?.title}:</strong> {current?.descr}
      </p>
    </div>
  );
}
