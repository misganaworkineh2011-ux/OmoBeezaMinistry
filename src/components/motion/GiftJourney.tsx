"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Icon, { type IconName } from "@/components/Icon";

export interface JourneyStop {
  title: string;
  text: string;
  icon: IconName;
}

// Donations page: "where your gift goes". A glowing heart travels from stop to
// stop (you give → a safe home → school → faith & family → a changed
// generation); each stop lights up as it arrives. Plays while on screen.
export default function GiftJourney({ stops }: { stops: JourneyStop[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setPlaying(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAt(stops.length - 1);
      return;
    }
    const timer = window.setInterval(() => setAt((a) => (a + 1) % stops.length), 2200);
    return () => window.clearInterval(timer);
  }, [playing, stops.length]);

  return (
    <div ref={ref} className={`journey__track${playing ? " is-playing" : ""}`} style={{ "--stops": stops.length, "--at": at } as CSSProperties}>
      <span className="journey__line" aria-hidden="true" />
      <span className="journey__glow" aria-hidden="true">
        <Icon name="heart" />
      </span>
      {stops.map((s, i) => (
        <div key={s.title} className={`journey__stop${i === at ? " is-lit" : ""}${i < at ? " is-done" : ""}`}>
          <div className="journey__badge">
            <Icon name={s.icon} />
            <span className="journey__num">{i + 1}</span>
          </div>
          <div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
