"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type Animation = "up" | "down" | "left" | "right" | "zoom";

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  animation?: Animation;
  /** Stagger delay in ms. */
  delay?: number;
  id?: string;
}

// Lightweight scroll-in animation. Honors prefers-reduced-motion via CSS
// (see globals.css `.reveal` rules).
export default function Reveal({ children, className, as: Tag = "div", animation = "up", delay, id }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const classes = ["reveal", `reveal--${animation}`, visible ? "is-visible" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <Tag ref={ref} id={id} className={classes} style={style}>
      {children}
    </Tag>
  );
}
