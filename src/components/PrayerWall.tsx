"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { LukaChild } from "@/lib/galleries";
import Icon from "@/components/Icon";
import Lightbox from "@/components/Lightbox";

// "Pray for a child" wall: polaroid-style cards that flip to reveal the
// prayer. Each card can open the original prayer card, or send a note
// committing to pray for that child.
export default function PrayerWall({ items }: { items: LukaChild[] }) {
  const t = useTranslations("gallery.luka");
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [prayed, setPrayed] = useState<Set<string>>(() => new Set());
  // Live prayer counts (start from the server value, +1 when this visitor commits).
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((c) => [c.slug, c.prayers ?? 0])),
  );

  const commit = (slug: string) => {
    if (prayed.has(slug)) return;
    setPrayed((prev) => new Set(prev).add(slug));
    setCounts((prev) => ({ ...prev, [slug]: (prev[slug] ?? 0) + 1 }));
    fetch("/api/pray", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  };
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const toggle = (slug: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  // Arriving from "Pray for <name>" (e.g. /gallery/luka#child-eyob): bring
  // that child's card into view, turned over to the prayer and highlighted.
  useEffect(() => {
    const slug = window.location.hash.replace(/^#child-/, "");
    if (!slug || !items.some((c) => c.slug === slug)) return;
    setFlipped((prev) => new Set(prev).add(slug));
    setSpotlight(slug);
    const scroll = window.setTimeout(() => {
      document.getElementById(`child-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    const clear = window.setTimeout(() => setSpotlight(null), 4000);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [items]);

  const pickRandom = () => {
    const child = items[Math.floor(Math.random() * items.length)];
    if (!child) return;
    setSpotlight(child.slug);
    setFlipped((prev) => new Set(prev).add(child.slug));
    document.getElementById(`child-${child.slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setSpotlight(null), 2600);
  };

  const slides = items.map((c) => ({ ...c.card, caption: t("cardOf", { name: c.name }) }));

  return (
    <>
      <div className="wall-toolbar">
        <p className="wall-toolbar__count">
          <strong>{items.length}</strong> {t("countLabel")}
          {prayed.size > 0 ? (
            <span className="wall-toolbar__prayed">
              <Icon name="handHeart" /> {t("prayedCount", { count: prayed.size })}
            </span>
          ) : null}
        </p>
        <button type="button" className="btn btn--gold" onClick={pickRandom}>
          <Icon name="sparkles" /> {t("random")}
        </button>
      </div>

      <ul className="wall">
        {items.map((child, i) => {
          const isFlipped = flipped.has(child.slug);
          const hasPrayed = prayed.has(child.slug);
          return (
            <li
              key={child.slug}
              id={`child-${child.slug}`}
              className={`flip${isFlipped ? " is-flipped" : ""}${spotlight === child.slug ? " is-spotlight" : ""}`}
              style={{ ["--tilt" as string]: `${((i * 37) % 7) - 3}deg` }}
            >
              <div className="flip__inner">
                <div className="flip__face flip__front" inert={isFlipped}>
                  <button type="button" className="flip__hit" onClick={() => toggle(child.slug)} aria-label={t("flip", { name: child.name })}>
                    <span className="polaroid__photo">
                      <Image
                        src={child.portrait.src}
                        alt={t("photoAlt", { name: child.name })}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1080px) 33vw, 280px"
                      />
                    </span>
                    <span className="polaroid__caption">
                      <span className="polaroid__name">{child.name}</span>
                      <span className="polaroid__hint">
                        <Icon name="handHeart" /> {t("tapToPray")}
                      </span>
                    </span>
                  </button>
                  {hasPrayed ? (
                    <span className="flip__badge" title={t("prayedFor")}>
                      <Icon name="heart" />
                    </span>
                  ) : null}
                </div>

                <div className="flip__face flip__back" inert={!isFlipped} data-lenis-prevent>
                  <span className="flip__back-icon">
                    <Icon name="handHeart" />
                  </span>
                  <h3>{t("prayFor", { name: child.name })}</h3>
                  <p>{t("prayer")}</p>
                  <p className="flip__count">
                    <Icon name="users" /> {hasPrayed ? t("thanks", { name: child.name }) : t("praying", { count: counts[child.slug] ?? 0 })}
                  </p>
                  <div className="flip__actions">
                    <button
                      type="button"
                      className={`btn btn--sm ${hasPrayed ? "btn--light" : "btn--gold"}`}
                      onClick={() => commit(child.slug)}
                      aria-pressed={hasPrayed}
                    >
                      <Icon name={hasPrayed ? "check" : "heart"} /> {hasPrayed ? t("prayedFor") : t("commit")}
                    </button>
                    <button type="button" className="btn btn--ghost-light btn--sm" onClick={() => setLightbox(i)}>
                      <Icon name="expand" /> {t("viewCard")}
                    </button>
                  </div>
                  <button type="button" className="flip__back-link" onClick={() => toggle(child.slug)}>
                    <Icon name="arrowLeft" /> {t("back")}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Lightbox items={slides} index={lightbox} onChange={setLightbox} />
    </>
  );
}
