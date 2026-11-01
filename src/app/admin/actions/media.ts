"use server";

import { headers } from "next/headers";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { uploadMode } from "@/lib/uploads";

// Copies the media bundled with the website (children's photos, album photos,
// videos, posters, blog covers) into Vercel Blob storage and points the
// database at the new URLs. Runs in small batches so each request stays well
// inside the server time limit; the dashboard calls it until nothing is left.

export interface MediaStatus {
  ok: boolean;
  moved: number;
  remaining: number;
  failed: string[];
  error?: string;
}

/** Columns that hold a single media path. */
const COLUMNS: [table: string, column: string][] = [
  ["children", "portrait"],
  ["children", "card"],
  ["photos", "src"],
  ["videos", "src"],
  ["videos", "preview"],
  ["videos", "poster"],
  ["posts", "cover"],
];

const LOCAL_MEDIA = /^\/[^/].*\.(jpe?g|png|webp|gif|svg|avif|mp4|webm|mov)$/i;
const IN_TEXT = /\/(?:media|img|uploads|lukaSiteChildern|carnival|visionSharingDay)\/[^\s)"'<>]+\.(?:jpe?g|png|webp|gif|avif|mp4|webm)/gi;

async function localPaths(): Promise<string[]> {
  const found = new Set<string>();
  for (const [table, column] of COLUMNS) {
    const rows = await query<{ v: string }>(`select distinct ${column} as v from ${table} where ${column} like '/%'`);
    for (const r of rows) if (LOCAL_MEDIA.test(r.v)) found.add(r.v);
  }
  const posts = await query<{ body_en: string; body_am: string }>("select body_en, body_am from posts");
  for (const p of posts) for (const m of `${p.body_en}\n${p.body_am}`.match(IN_TEXT) ?? []) found.add(m);
  const done = new Set((await query<{ path: string }>("select path from media_map")).map((r) => r.path));
  return [...found].filter((p) => !done.has(p)).sort();
}

/** Point every database reference at the Blob copies made so far. */
async function rewrite(): Promise<void> {
  for (const [table, column] of COLUMNS) {
    await query(`update ${table} t set ${column} = m.url from media_map m where t.${column} = m.path`);
  }
  const map = new Map((await query<{ path: string; url: string }>("select path, url from media_map")).map((r) => [r.path, r.url]));
  const posts = await query<{ id: number; body_en: string; body_am: string }>("select id, body_en, body_am from posts");
  for (const p of posts) {
    const fix = (text: string) => text.replace(IN_TEXT, (m) => map.get(m) ?? m);
    const en = fix(p.body_en);
    const am = fix(p.body_am);
    if (en !== p.body_en || am !== p.body_am) await query("update posts set body_en = $1, body_am = $2 where id = $3", [en, am, p.id]);
  }
}

export async function mediaStatus(): Promise<number> {
  await requireUser();
  return (await localPaths()).length;
}

export async function moveMediaBatch(): Promise<MediaStatus> {
  await requireUser();
  const mode = uploadMode();
  if (mode !== "blob" && mode !== "presigned") {
    return { ok: false, moved: 0, remaining: 0, failed: [], error: "Connect a Vercel Blob store to this project first." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const pending = await localPaths();
  const started = Date.now();
  const failed: string[] = [];
  let moved = 0;

  for (const path of pending) {
    if (Date.now() - started > 35_000) break;
    try {
      const res = await fetch(origin + encodeURI(path), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      const blob = await put(path.slice(1), body, {
        access: "public",
        addRandomSuffix: true,
        multipart: body.length > 8 * 1024 * 1024,
        contentType: res.headers.get("content-type") ?? undefined,
      });
      await query("insert into media_map (path, url) values ($1, $2) on conflict (path) do update set url = excluded.url", [path, blob.url]);
      moved++;
    } catch (err) {
      failed.push(`${path}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  if (moved) {
    await rewrite();
    refresh("children", "albums", "videos", "posts");
  }
  const remaining = (await localPaths()).length;
  return { ok: failed.length === 0, moved, remaining, failed };
}
