import "server-only";
import { cache } from "react";
import { query, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";
import { FILE_MESSAGES, isPlainObject } from "@/lib/messages";
import { FILE_VIDEOS, type Video, type VideoKind } from "@/lib/videos";

interface VideoRow {
  id: string;
  kind: VideoKind;
  src: string;
  preview: string;
  poster: string;
  w: number;
  h: number;
  duration: number;
  title_en: string;
  title_am: string;
  tag_en: string;
  tag_am: string;
}

function fileVideos(locale: string): Video[] {
  const label = (id: string) => {
    const pick = (loc: string) => {
      const videos = FILE_MESSAGES[loc]?.videos;
      const items = isPlainObject(videos) ? videos.items : undefined;
      const item = isPlainObject(items) ? items[id] : undefined;
      return isPlainObject(item) ? item : {};
    };
    const en = pick("en");
    const loc = pick(locale);
    return { title: String(loc.title ?? en.title ?? id), tag: String(loc.tag ?? en.tag ?? "") };
  };
  return FILE_VIDEOS.map((v) => ({ ...v, ...label(v.id) }));
}

const readVideos = cached(
  async (locale: string): Promise<Video[] | null> => {
    const total = await query<{ n: number }>("select count(*)::int as n from videos");
    if ((total[0]?.n ?? 0) === 0) return null;
    const rows = await query<VideoRow>("select * from videos where active order by sort, id");
    const am = locale === "am";
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      src: r.src,
      preview: r.preview || r.src,
      poster: r.poster,
      w: r.w,
      h: r.h,
      duration: r.duration,
      title: (am && r.title_am) || r.title_en,
      tag: (am && r.tag_am) || r.tag_en,
    }));
  },
  "videos",
  ["videos"],
);

export const getVideos = cache(
  async (locale: string): Promise<Video[]> => (await safeRead(() => readVideos(locale), null)) ?? fileVideos(locale),
);

/** The featured documentary, the logo film, and the short clips. */
export async function getVideoSets(locale: string) {
  const all = await getVideos(locale);
  return {
    all,
    featureFilm: all.find((v) => v.kind === "film"),
    logoFilm: all.find((v) => v.kind === "logo"),
    reels: all.filter((v) => v.kind === "reel"),
  };
}
