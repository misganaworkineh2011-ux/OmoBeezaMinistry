import "server-only";
import { cache } from "react";
import { query, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";
import { FILE_MESSAGES, isPlainObject } from "@/lib/messages";
import { FILE_ALBUMS, FILE_ALBUM_ICONS, FILE_CHILDREN, type Album, type LukaChild, type Photo } from "@/lib/galleries";

// ---- Luka children (prayer wall) ----

interface ChildRow {
  slug: string;
  name: string;
  portrait: string;
  portrait_w: number;
  portrait_h: number;
  card: string | null;
  card_w: number | null;
  card_h: number | null;
  prayers: number;
}

const readChildren = cached(
  async (): Promise<LukaChild[] | null> => {
    const rows = await query<ChildRow>(
      "select slug, name, portrait, portrait_w, portrait_h, card, card_w, card_h, prayers from children where active order by sort, id",
    );
    const total = await query<{ n: number }>("select count(*)::int as n from children");
    if ((total[0]?.n ?? 0) === 0) return null; // never set up: use the files
    return rows.map((r) => {
      const portrait = { src: r.portrait, w: r.portrait_w, h: r.portrait_h };
      return {
        slug: r.slug,
        name: r.name,
        portrait,
        card: r.card ? { src: r.card, w: r.card_w ?? portrait.w, h: r.card_h ?? portrait.h } : portrait,
        prayers: r.prayers,
      };
    });
  },
  "children",
  ["children"],
);

export const getLukaChildren = cache(
  async (): Promise<LukaChild[]> => (await safeRead(readChildren, null)) ?? FILE_CHILDREN,
);

// ---- Photo albums ----

interface AlbumRow {
  id: string;
  icon: string;
  title_en: string;
  title_am: string;
  tag_en: string;
  tag_am: string;
  descr_en: string;
  descr_am: string;
}

function fileAlbumText(locale: string, id: string): { title: string; tag: string; descr: string } {
  const pick = (loc: string) => {
    const gallery = FILE_MESSAGES[loc]?.gallery;
    const entry = isPlainObject(gallery) ? gallery[id] : undefined;
    return isPlainObject(entry) ? entry : {};
  };
  const en = pick("en");
  const loc = pick(locale);
  const get = (k: string) => String(loc[k] ?? en[k] ?? "");
  return { title: get("title"), tag: get("tag"), descr: get("descr") };
}

function fileAlbums(locale: string): Album[] {
  return Object.entries(FILE_ALBUMS).map(([id, photos]) => ({
    id,
    icon: FILE_ALBUM_ICONS[id] ?? "sparkles",
    ...fileAlbumText(locale, id),
    photos,
  }));
}

const readAlbums = cached(
  async (locale: string): Promise<Album[] | null> => {
    const albums = await query<AlbumRow>("select * from albums order by sort, created_at");
    if (albums.length === 0) return null;
    const photos = await query<{ album_id: string; src: string; w: number; h: number; caption: string }>(
      "select album_id, src, w, h, caption from photos order by sort, id",
    );
    const am = locale === "am";
    return albums.map((a) => ({
      id: a.id,
      icon: a.icon,
      title: (am && a.title_am) || a.title_en,
      tag: (am && a.tag_am) || a.tag_en,
      descr: (am && a.descr_am) || a.descr_en,
      photos: photos
        .filter((p) => p.album_id === a.id)
        .map((p): Photo => ({ src: p.src, w: p.w, h: p.h, caption: p.caption || undefined })),
    }));
  },
  "albums",
  ["albums"],
);

export const getAlbums = cache(
  async (locale: string): Promise<Album[]> => (await safeRead(() => readAlbums(locale), null)) ?? fileAlbums(locale),
);

export async function getAlbum(locale: string, id: string): Promise<Album | null> {
  return (await getAlbums(locale)).find((a) => a.id === id) ?? null;
}
