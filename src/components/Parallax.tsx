"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Moves its content slightly against the scroll direction for depth.
// `speed` is the fraction of the element's distance from viewport center.
export default function Parallax({
  children,
  speed = 0.12,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.parentElement?.getBoundingClientRect() ?? node.getBoundingClientRect();
      const offset = rect.top + rect.height / 2 - window.innerHeight / 2;
      node.style.transform = `translate3d(0, ${(offset * -speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [speed]);

  return (
    <div ref={ref} className={`parallax${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
