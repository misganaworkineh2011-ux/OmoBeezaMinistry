"use client";

import { useCallback, useRef, useState } from "react";
import { formatDuration, type Video } from "@/lib/videos";
import { useInViewPlayback } from "@/components/useInViewPlayback";
import VideoTheater from "@/components/VideoTheater";
import Icon from "@/components/Icon";

interface FeatureFilmProps {
  video: Video;
  title: string;
  tag: string;
  playLabel: string;
  seal: string;
  closeLabel: string;
}

// Cinematic widescreen card: a silent preview loops behind a film-strip frame;
// the play button (with a rotating title ring) opens the full film in the theater.
export default function FeatureFilm({ video, title, tag, playLabel, seal, closeLabel }: FeatureFilmProps) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const playing = useInViewPlayback(previewRef, 0.35);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <div className="film">
        <div className="film__perfs film__perfs--top" aria-hidden="true" />
        <button type="button" className="film__screen" onClick={() => setOpen(true)} aria-label={`${playLabel}: ${title}`}>
          <video
            ref={previewRef}
            className={playing ? "is-playing" : undefined}
            src={video.preview}
            poster={video.poster}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <span className="film__shade" aria-hidden="true" />
          <span className="film__play" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="film__ring">
              <defs>
                <path id="film-ring" d="M60,60 m-48,0 a48,48 0 1,1 96,0 a48,48 0 1,1 -96,0" />
              </defs>
              <text>
                <textPath href="#film-ring">{seal}</textPath>
              </text>
            </svg>
            <span className="film__play-core">
              <Icon name="play" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
          <span className="film__caption">
            <span className="film__tag">
              <Icon name="film" /> {tag} · {formatDuration(video.duration)}
            </span>
            <span className="film__title">{title}</span>
          </span>
        </button>
        <div className="film__perfs film__perfs--bottom" aria-hidden="true" />
      </div>

      <VideoTheater video={open ? video : null} title={title} tag={tag} closeLabel={closeLabel} onClose={close} />
    </>
  );
}
