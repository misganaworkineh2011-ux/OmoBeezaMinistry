import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_UPLOAD_TYPES, FILES_PREFIX, MAX_UPLOAD_BYTES, safeFileName, uploadMode, uploadsDir } from "@/lib/uploads";
import { json } from "@/lib/ratelimit";

// Dashboard uploads (signed-in admins only).
//  • Vercel Blob: the browser asks this route for a short-lived token (or a
//    presigned URL when Blob is connected via BLOB_STORE_ID), then
//    uploads straight to Blob storage (so large videos never pass through
//    the server).
//  • Server folder (UPLOADS_DIR, e.g. on Yegara): the browser sends the file
//    in 4 MB pieces (start → PUT each piece → finish), so big videos never
//    hit the host's request-size limits or fill the server's memory.
//  • Local development: the file is posted here and saved to public/uploads.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bytes per piece in "disk" mode (the browser sends this much per request). */
const CHUNK = 4 * 1024 * 1024;

const tmpDir = () => path.join(uploadsDir(), ".tmp");
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);

interface Pending {
  name: string;
  folder: string;
  size: number;
}

/** Forget unfinished uploads older than a day. */
async function sweep(): Promise<void> {
  const dir = tmpDir();
  const now = Date.now();
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    const full = path.join(dir, f);
    const info = await stat(full).catch(() => null);
    if (info && now - info.mtimeMs > 86_400_000) await rm(full, { force: true });
  }
}

async function diskUpload(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json(400, { error: "bad_request" });

  if (body.action === "start") {
    const name = typeof body.name === "string" ? body.name : "file";
    const type = typeof body.type === "string" ? body.type : "";
    const size = Number(body.size);
    if (!ALLOWED_UPLOAD_TYPES.includes(type) && !/\.(md|txt|docx)$/i.test(name)) return json(400, { error: "type_not_allowed" });
    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return json(400, { error: "too_large" });
    const folder = String(body.folder ?? "misc").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc";
    const id = randomBytes(12).toString("hex");
    await mkdir(tmpDir(), { recursive: true });
    await sweep();
    await writeFile(path.join(tmpDir(), `${id}.json`), JSON.stringify({ name, folder, size } satisfies Pending));
    await writeFile(path.join(tmpDir(), id), "");
    return Response.json({ id, chunk: CHUNK });
  }

  if (body.action === "finish" && validId(body.id)) {
    const meta = JSON.parse(await readFile(path.join(tmpDir(), `${body.id}.json`), "utf8").catch(() => "null")) as Pending | null;
    const part = path.join(tmpDir(), body.id);
    const got = (await stat(part).catch(() => null))?.size;
    if (!meta) return json(404, { error: "upload_not_found" });
    if (got !== meta.size) return json(400, { error: "upload_incomplete" });
    const name = safeFileName(meta.name, randomBytes(4).toString("hex"));
    const dir = path.join(uploadsDir(), meta.folder);
    await mkdir(dir, { recursive: true });
    await rename(part, path.join(dir, name));
    await rm(path.join(tmpDir(), `${body.id}.json`), { force: true });
    return Response.json({ url: `${FILES_PREFIX}${meta.folder}/${name}` });
  }

  return json(400, { error: "bad_request" });
}

/** One piece of a "disk" upload: PUT /api/admin/upload?id=…&offset=… with the raw bytes. */
export async function PUT(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "unauthorized" });
  if (uploadMode() !== "disk") return json(400, { error: "bad_request" });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const offset = Number(url.searchParams.get("offset"));
  if (!validId(id)) return json(400, { error: "bad_request" });
  const meta = JSON.parse(await readFile(path.join(tmpDir(), `${id}.json`), "utf8").catch(() => "null")) as Pending | null;
  const part = path.join(tmpDir(), id);
  const have = (await stat(part).catch(() => null))?.size;
  if (!meta || have === undefined) return json(404, { error: "upload_not_found" });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > CHUNK || offset + bytes.length > meta.size) return json(400, { error: "too_large" });
  // A repeated piece (the browser retried after a dropped connection) is skipped.
  if (offset + bytes.length <= have) return Response.json({ received: have });
  if (offset !== have) return json(409, { error: "wrong_offset", received: have });
  await appendFile(part, bytes);
  return Response.json({ received: have + bytes.length });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "unauthorized" });
  const mode = uploadMode();

  if (mode === "disk") return diskUpload(request);

  if (mode === "blob") {
    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: ALLOWED_UPLOAD_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        }),
        onUploadCompleted: async () => {},
      });
      return Response.json(result);
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : "upload_failed" });
    }
  }

  if (mode === "presigned") {
    try {
      const body = (await request.json()) as HandleUploadPresignedBody;
      const result = await handleUploadPresigned({
        body,
        request,
        getSignedToken: async (pathname) => ({
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ALLOWED_UPLOAD_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
          }),
          urlOptions: {
            allowedContentTypes: ALLOWED_UPLOAD_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            addRandomSuffix: true,
          },
        }),
      });
      return Response.json(result);
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : "upload_failed" });
    }
  }

  if (mode === "local") {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "misc").replace(/[^a-z0-9-]/gi, "") || "misc";
    if (!(file instanceof File)) return json(400, { error: "no_file" });
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type) && !/\.(md|txt|docx)$/i.test(file.name)) {
      return json(400, { error: "type_not_allowed" });
    }
    if (file.size > MAX_UPLOAD_BYTES) return json(400, { error: "too_large" });
    const name = safeFileName(file.name, randomBytes(4).toString("hex"));
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return Response.json({ url: `/uploads/${folder}/${name}` });
  }

  return json(503, { error: "uploads_not_configured" });
}
