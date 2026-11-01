"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Plays a muted preview <video> only while it is on screen (saves data and
 * battery), and never under prefers-reduced-motion. Returns whether it's playing.
 */
export function useInViewPlayback(ref: RefObject<HTMLVideoElement | null>, threshold = 0.5): boolean {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          video.play().then(
            () => setPlaying(true),
            () => setPlaying(false),
          );
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return playing;
}
