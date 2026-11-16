import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { CONTENT_TYPES, diskPath, FILES_PREFIX } from "@/lib/uploads";

// GET /files/<folder>/<name> — photos, videos and documents uploaded in the
// dashboard when they are stored on this server (UPLOADS_DIR, e.g. Yegara).
// Supports byte ranges, so videos start quickly and can be scrubbed.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

async function serve(request: Request, params: Promise<{ path: string[] }>, head: boolean): Promise<Response> {
  const parts = (await params).path ?? [];
  const file = diskPath(FILES_PREFIX + parts.map(encodeURIComponent).join("/"));
  if (!file) return notFound();
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return notFound();

  const size = info.size;
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    // File names carry a random part, so a name never gets new content.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": info.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  };

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && size > 0) {
    if (range[1] === "") {
      start = Math.max(0, size - Number(range[2]));
    } else {
      start = Number(range[1]);
      if (range[2] !== "") end = Math.min(end, Number(range[2]));
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(size === 0 ? 0 : end - start + 1);

  if (head || size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}

export function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  return serve(request, ctx.params, false);
}

export function HEAD(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  return serve(request, ctx.params, true);
}
