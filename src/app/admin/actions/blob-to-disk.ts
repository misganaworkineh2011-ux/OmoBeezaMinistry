"use server";

import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { FILES_PREFIX, uploadMode, uploadsDir } from "@/lib/uploads";

// Moving off Vercel: copies every photo, video and document that the database
// still links in Vercel Blob storage onto this server's uploads folder, and
// points the database at the copies (/files/…). It looks through every text
// column of every table, so nothing is missed. Runs in batches of ~40 seconds;
// the dashboard calls it until nothing is left. Safe to run again.

export interface PullStatus {
  ok: boolean;
  copied: number;
  remaining: number;
  failed: string[];
  error?: string;
}

const BLOB_URL = /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>)\\]+/gi;
const LIKE = "%.public.blob.vercel-storage.com/%";
const SKIP_TABLES = new Set(["blob_map", "sessions", "registrar_sessions"]);

interface Column {
  table: string;
  column: string;
  type: string;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function textColumns(): Promise<Column[]> {
  const rows = await query<{ table_name: string; column_name: string; udt_name: string }>(
    `select c.table_name, c.column_name, c.udt_name from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.udt_name in ('text', 'varchar', 'jsonb', 'json')`,
  );
  return rows.filter((r) => !SKIP_TABLES.has(r.table_name)).map((r) => ({ table: r.table_name, column: r.column_name, type: r.udt_name }));
}

/** Every Blob link still in the database, with the columns it appears in. */
async function scan(): Promise<Map<string, Column[]>> {
  const found = new Map<string, Column[]>();
  for (const col of await textColumns()) {
    const rows = await query<{ v: string }>(
      `select ${ident(col.column)}::text as v from ${ident(col.table)} where ${ident(col.column)}::text like $1`,
      [LIKE],
    );
    for (const r of rows) {
      for (const url of r.v.match(BLOB_URL) ?? []) {
        const cols = found.get(url) ?? [];
        if (!cols.some((c) => c.table === col.table && c.column === col.column)) cols.push(col);
        found.set(url, cols);
      }
    }
  }
  return found;
}

/** "https://x.public.blob.vercel-storage.com/children/a b-x1.jpg" → "children/a-b-x1.jpg". */
function localName(url: string): string {
  const segments = decodeURIComponent(new URL(url).pathname)
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+/, "") || "file");
  if (segments.length === 1) segments.unshift("blob");
  return segments.join("/");
}

async function replaceEverywhere(url: string, local: string, cols: Column[]): Promise<void> {
  for (const col of cols) {
    const cast = col.type === "jsonb" ? "::jsonb" : col.type === "json" ? "::json" : "";
    await query(
      `update ${ident(col.table)} set ${ident(col.column)} = replace(${ident(col.column)}::text, $1, $2)${cast}
       where ${ident(col.column)}::text like '%' || $1 || '%'`,
      [url, local],
    );
  }
}

async function download(url: string, file: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>), createWriteStream(part));
    await rename(part, file);
  } catch (err) {
    await rm(part, { force: true });
    throw err;
  }
}

async function ensureTable(): Promise<void> {
  await query("create table if not exists blob_map (url text primary key, path text not null, created_at timestamptz not null default now())");
}

/** How many Blob files the database still links (0 when not storing files on this server). */
export async function blobFilesLeft(): Promise<number> {
  await requireUser();
  if (uploadMode() !== "disk") return 0;
  return (await scan()).size;
}

export async function pullBlobBatch(): Promise<PullStatus> {
  await requireUser();
  if (uploadMode() !== "disk") {
    return { ok: false, copied: 0, remaining: 0, failed: [], error: "Files are not stored on this server (UPLOADS_DIR is not set)." };
  }
  await ensureTable();
  const started = Date.now();
  const found = await scan();
  const done = new Map((await query<{ url: string; path: string }>("select url, path from blob_map")).map((r) => [r.url, r.path]));
  const failed: string[] = [];
  let copied = 0;
  let changed = false;

  for (const [url, cols] of found) {
    let local = done.get(url);
    if (!local) {
      if (Date.now() - started > 40_000) continue;
      const name = localName(url);
      try {
        await download(url, path.join(uploadsDir(), ...name.split("/")));
        local = `${FILES_PREFIX}${name}`;
        await query("insert into blob_map (url, path) values ($1, $2) on conflict (url) do update set path = excluded.path", [url, local]);
        copied++;
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : "failed"}`);
        continue;
      }
    }
    await replaceEverywhere(url, local, cols);
    changed = true;
  }

  if (changed) refresh("settings", "content", "posts", "children", "albums", "videos", "knowledge");
  const remaining = (await scan()).size;
  return { ok: failed.length === 0, copied, remaining, failed };
}
