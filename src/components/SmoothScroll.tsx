"use client";

import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

// Site-wide smooth (inertia) scrolling. Uses the document root scroller, so the
// header's scroll listener and IntersectionObserver-based reveals keep working.
// `anchors` makes in-page links (#pray, #partner…) glide to their target.
export default function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true, anchors: { offset: -100 } }}>
      {children}
    </ReactLenis>
  );
}
