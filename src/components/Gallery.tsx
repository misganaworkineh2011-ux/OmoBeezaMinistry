"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";
import Lightbox from "@/components/Lightbox";

export interface GalleryItem {
  image: string;
  caption: string;
  tag: string;
  w: number;
  h: number;
}

const FILTERS = ["all", "family", "learning", "joy"] as const;
type Filter = (typeof FILTERS)[number];

// Filterable masonry gallery with a keyboard-accessible lightbox.
export default function Gallery({ items }: { items: GalleryItem[] }) {
  const t = useTranslations("stories.filters");
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState<number | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.tag === filter)),
    [filter, items],
  );
  const slides = useMemo(
    () => visible.map((i) => ({ src: i.image, w: i.w, h: i.h, caption: i.caption })),
    [visible],
  );

  return (
    <>
      <div className="gallery-filters" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(f)}
          </button>
        ))}
      </div>

      <div className="gallery">
        {visible.map((item, i) => (
          <button key={item.image} type="button" className="gallery__item" onClick={() => setIndex(i)} aria-label={item.caption}>
            <Image
              src={item.image}
              alt={item.caption}
              width={item.w}
              height={item.h}
              sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 400px"
            />
            <span className="gallery__zoom" aria-hidden="true">
              <Icon name="expand" />
            </span>
            <span className="gallery__caption">{item.caption}</span>
          </button>
        ))}
      </div>

      <Lightbox items={slides} index={index} onChange={setIndex} />
    </>
  );
}
