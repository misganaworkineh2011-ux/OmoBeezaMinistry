"use client";

import { useEffect, useRef, useState } from "react";

interface CounterProps {
  value: number;
  suffix?: string;
  /** Animation length in ms. */
  duration?: number;
}

// Counts up when scrolled into view. Large values (e.g. years) start close to
// their target so the motion stays subtle. Renders the final value on the
// server and under prefers-reduced-motion.
export default function Counter({ value, suffix = "", duration = 1600 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = value > 1000 ? value - 40 : 0;
    setDisplay(start);
    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 4);
          setDisplay(Math.round(start + (value - start) * eased));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
