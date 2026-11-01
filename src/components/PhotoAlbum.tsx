"use client";

import { useState } from "react";
import Image from "next/image";
import type { Photo } from "@/lib/galleries";
import Icon from "@/components/Icon";
import Lightbox from "@/components/Lightbox";

// Editorial event album: a varied "bento" rhythm (every few photos one is
// featured large) that opens into the lightbox.
export default function PhotoAlbum({ photos, title }: { photos: Photo[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const slides = photos.map((p, i) => ({ ...p, caption: p.caption || `${title} · ${i + 1}` }));

  return (
    <>
      <div className="bento">
        {photos.map((p, i) => {
          const portrait = p.h > p.w;
          const feature = i % 7 === 0;
          const cls = feature ? " bento__item--feature" : portrait ? " bento__item--tall" : "";
          return (
            <button
              key={p.src}
              type="button"
              className={`bento__item${cls}`}
              onClick={() => setIndex(i)}
              aria-label={`${title} — ${i + 1}`}
            >
              <Image
                src={p.src}
                alt=""
                fill
                sizes={feature ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 50vw, 33vw"}
              />
              <span className="gallery__zoom" aria-hidden="true">
                <Icon name="expand" />
              </span>
            </button>
          );
        })}
      </div>
      <Lightbox items={slides} index={index} onChange={setIndex} />
    </>
  );
}
