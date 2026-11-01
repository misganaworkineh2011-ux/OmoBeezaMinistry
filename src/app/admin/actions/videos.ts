"use server";

import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import type { VideoKind } from "@/lib/videos";

export interface VideoInput {
  id?: string;
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
  active: boolean;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown, min = 0) => Math.max(min, Math.round(Number(v) || 0));
const KINDS: VideoKind[] = ["film", "reel", "logo"];

export async function saveVideo(input: VideoInput): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const title = s(input.title_en, 140);
  const src = s(input.src, 500);
  if (!title) return { ok: false, error: "The English title is required." };
  if (!src) return { ok: false, error: "Upload a video first." };
  const kind = KINDS.includes(input.kind) ? input.kind : "reel";
  const values = [
    kind,
    src,
    s(input.preview, 500) || src,
    s(input.poster, 500),
    n(input.w, 1),
    n(input.h, 1),
    n(input.duration),
    title,
    s(input.title_am, 140),
    s(input.tag_en, 60),
    s(input.tag_am, 60),
    Boolean(input.active),
  ];

  if (input.id) {
    await query(
      `update videos set kind=$1, src=$2, preview=$3, poster=$4, w=$5, h=$6, duration=$7,
       title_en=$8, title_am=$9, tag_en=$10, tag_am=$11, active=$12 where id=$13`,
      [...values, input.id],
    );
  } else {
    let id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "video";
    if (await queryOne("select 1 from videos where id = $1", [id])) id = `${id}-${Date.now().toString(36).slice(-4)}`;
    const sort = (await queryOne<{ n: number }>("select coalesce(max(sort), -1)::int + 1 as n from videos"))?.n ?? 0;
    await query(
      `insert into videos (kind, src, preview, poster, w, h, duration, title_en, title_am, tag_en, tag_am, active, id, sort)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [...values, id, sort],
    );
  }
  refresh("videos");
  return { ok: true };
}

export async function deleteVideo(id: string): Promise<void> {
  await requireUser();
  await query("delete from videos where id = $1", [id]);
  refresh("videos");
}

export async function moveVideo(id: string, dir: -1 | 1): Promise<void> {
  await requireUser();
  const rows = await query<{ id: string }>("select id from videos order by sort, id");
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [sort, r] of rows.entries()) await query("update videos set sort = $1 where id = $2", [sort, r.id]);
  refresh("videos");
}
