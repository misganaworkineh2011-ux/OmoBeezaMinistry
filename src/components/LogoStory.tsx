"use client";

import { useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import Icon, { type IconName } from "@/components/Icon";

interface Point {
  icon: IconName;
  title: string;
  descr: string;
}

// The logo animation plays once when scrolled into view; as it settles on the
// finished emblem, the meaning of each symbol fades in beside it.
export default function LogoStory({ video, points, replay }: { video: Video; points: Point[]; replay: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Show the finished emblem and all notes immediately.
      node.currentTime = Math.max(0, video.duration - 1);
      setRevealed(true);
      setEnded(true);
      return;
    }
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started) {
          started = true;
          node.play().catch(() => setEnded(true));
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    // Reveal the notes once the emblem has formed (~60% through).
    const onTime = () => {
      if (node.duration && node.currentTime / node.duration > 0.55) setRevealed(true);
    };
    const onEnded = () => setEnded(true);
    node.addEventListener("timeupdate", onTime);
    node.addEventListener("ended", onEnded);
    return () => {
      observer.disconnect();
      node.removeEventListener("timeupdate", onTime);
      node.removeEventListener("ended", onEnded);
    };
  }, [video.duration]);

  const again = () => {
    const node = ref.current;
    if (!node) return;
    setEnded(false);
    node.currentTime = 0;
    node.play().catch(() => setEnded(true));
  };

  return (
    <div className={`logo-story${revealed ? " is-revealed" : ""}`}>
      <div className="logo-story__screen">
        <video ref={ref} src={video.src} poster={video.poster} muted playsInline preload="metadata" aria-hidden="true" />
        {ended ? (
          <button type="button" className="logo-story__replay" onClick={again}>
            <Icon name="repeat" /> {replay}
          </button>
        ) : null}
      </div>
      <ol className="logo-story__points">
        {points.map((p, i) => (
          <li key={p.title} style={{ transitionDelay: `${i * 220}ms` }}>
            <span className="logo-story__icon">
              <Icon name={p.icon} />
            </span>
            <span>
              <strong>{p.title}</strong>
              <span>{p.descr}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
