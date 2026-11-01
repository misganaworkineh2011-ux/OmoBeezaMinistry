"use server";

import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";

export interface AlbumInput {
  id: string;
  title_en: string;
  title_am: string;
  tag_en: string;
  tag_am: string;
  descr_en: string;
  descr_am: string;
  icon: string;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const RESERVED = new Set(["luka", "new"]);

export async function createAlbum(title: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireUser();
  const t = s(title, 120);
  if (!t) return { ok: false, error: "Enter an album title." };
  let id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || `album-${Date.now().toString(36)}`;
  if (RESERVED.has(id) || (await queryOne("select 1 from albums where id = $1", [id]))) id = `${id}-${Date.now().toString(36).slice(-4)}`;
  const sort = (await queryOne<{ n: number }>("select coalesce(max(sort), -1)::int + 1 as n from albums"))?.n ?? 0;
  await query("insert into albums (id, title_en, sort) values ($1, $2, $3)", [id, t, sort]);
  refresh("albums");
  return { ok: true, id };
}

export async function saveAlbum(input: AlbumInput): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!s(input.title_en, 120)) return { ok: false, error: "The English title is required." };
  await query(
    "update albums set title_en=$1, title_am=$2, tag_en=$3, tag_am=$4, descr_en=$5, descr_am=$6, icon=$7 where id=$8",
    [
      s(input.title_en, 120),
      s(input.title_am, 120),
      s(input.tag_en, 60),
      s(input.tag_am, 60),
      s(input.descr_en, 600),
      s(input.descr_am, 600),
      s(input.icon, 30) || "sparkles",
      input.id,
    ],
  );
  refresh("albums");
  return { ok: true };
}

export async function deleteAlbum(id: string): Promise<void> {
  await requireUser();
  await query("delete from albums where id = $1", [id]);
  refresh("albums");
}

export async function moveAlbum(id: string, dir: -1 | 1): Promise<void> {
  await requireUser();
  const rows = await query<{ id: string }>("select id from albums order by sort, created_at");
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [sort, r] of rows.entries()) await query("update albums set sort = $1 where id = $2", [sort, r.id]);
  refresh("albums");
}

export async function addPhotos(albumId: string, photos: { src: string; w: number; h: number }[]): Promise<void> {
  await requireUser();
  let sort = (await queryOne<{ n: number }>("select coalesce(max(sort), -1)::int + 1 as n from photos where album_id = $1", [albumId]))?.n ?? 0;
  for (const p of photos.slice(0, 200)) {
    if (!s(p.src, 500)) continue;
    await query("insert into photos (album_id, src, w, h, sort) values ($1, $2, $3, $4, $5)", [
      albumId,
      s(p.src, 500),
      Math.max(1, Math.round(p.w)),
      Math.max(1, Math.round(p.h)),
      sort++,
    ]);
  }
  refresh("albums");
}

export async function updateCaption(photoId: number, caption: string): Promise<void> {
  await requireUser();
  await query("update photos set caption = $1 where id = $2", [s(caption, 200), photoId]);
  refresh("albums");
}

export async function deletePhoto(photoId: number): Promise<void> {
  await requireUser();
  await query("delete from photos where id = $1", [photoId]);
  refresh("albums");
}

export async function movePhoto(albumId: string, photoId: number, to: "first" | -1 | 1): Promise<void> {
  await requireUser();
  const rows = await query<{ id: number }>("select id from photos where album_id = $1 order by sort, id", [albumId]);
  const i = rows.findIndex((r) => r.id === photoId);
  if (i < 0) return;
  if (to === "first") rows.unshift(...rows.splice(i, 1));
  else {
    const j = i + to;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  for (const [sort, r] of rows.entries()) await query("update photos set sort = $1 where id = $2", [sort, r.id]);
  refresh("albums");
}
