"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { formatDuration, type Video } from "@/lib/videos";
import { useInViewPlayback } from "@/components/useInViewPlayback";
import VideoTheater from "@/components/VideoTheater";
import Icon from "@/components/Icon";

export interface ReelLabel {
  title: string;
  tag: string;
}

interface ReelRailProps {
  reels: Video[];
  watch: string;
  prev: string;
  next: string;
  closeLabel: string;
  /** Optional heading shown in a row with the scroll arrows (used inside a larger section). */
  heading?: ReactNode;
}

function Reel({ video, label, watch, onOpen }: { video: Video; label: ReelLabel; watch: string; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const playing = useInViewPlayback(ref, 0.6);
  return (
    <li className={`reel${playing ? " is-playing" : ""}`}>
      <button type="button" className="reel__phone" onClick={onOpen} aria-label={`${watch}: ${label.title}`}>
        {/* Blurred poster behind, so square or landscape clips still fill the phone frame. */}
        <span className="reel__backdrop" style={{ backgroundImage: `url(${video.poster})` }} aria-hidden="true" />
        <video ref={ref} src={video.preview} poster={video.poster} muted loop playsInline preload="metadata" aria-hidden="true" />
        <span className="reel__progress" aria-hidden="true">
          <span />
        </span>
        <span className="reel__shade" aria-hidden="true" />
        <span className="reel__meta">
          <span className="reel__tag">{label.tag}</span>
          <span className="reel__title">{label.title}</span>
          <span className="reel__watch">
            <span className="reel__watch-icon">
              <Icon name="play" fill="currentColor" strokeWidth={0} />
            </span>
            {watch} · {formatDuration(video.duration)}
          </span>
        </span>
      </button>
    </li>
  );
}

// Horizontal rail of phone-shaped "reels": previews play silently while in view,
// tapping one opens the full clip with sound.
export default function ReelRail({ reels, watch, prev, next, closeLabel, heading }: ReelRailProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<Video | null>(null);
  const close = useCallback(() => setActive(null), []);

  const scroll = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: dir * Math.min(rail.clientWidth * 0.8, 640), behavior: "smooth" });
  };

  const labelOf = (v: Video): ReelLabel => ({ title: v.title ?? "", tag: v.tag ?? "" });

  const arrows = (
    <div className={`reels__nav${heading ? " reels__nav--inline" : ""}`}>
      <button type="button" className="reels__arrow" onClick={() => scroll(-1)} aria-label={prev}>
        <Icon name="arrowLeft" />
      </button>
      <button type="button" className="reels__arrow" onClick={() => scroll(1)} aria-label={next}>
        <Icon name="arrowRight" />
      </button>
    </div>
  );

  return (
    <div className="reels">
      {heading ? (
        <div className="reels__head">
          {heading}
          {arrows}
        </div>
      ) : (
        arrows
      )}
      <ul ref={railRef} className="reels__rail" data-lenis-prevent-horizontal>
        {reels.map((v) => (
          <Reel key={v.id} video={v} label={labelOf(v)} watch={watch} onOpen={() => setActive(v)} />
        ))}
      </ul>
      <VideoTheater
        video={active}
        title={active?.title}
        tag={active?.tag}
        closeLabel={closeLabel}
        onClose={close}
      />
    </div>
  );
}
