import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, uploadMode } from "@/lib/uploads";
import { json } from "@/lib/ratelimit";

// Dashboard uploads (signed-in admins only).
//  • Vercel Blob: the browser asks this route for a short-lived token (or a
//    presigned URL when Blob is connected via BLOB_STORE_ID), then
//    uploads straight to Blob storage (so large videos never pass through
//    the server).
//  • Local development: the file is posted here and saved to public/uploads.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "unauthorized" });
  const mode = uploadMode();

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
    const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || "";
    const base = path.basename(file.name, path.extname(file.name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const name = `${base || "file"}-${randomBytes(4).toString("hex")}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return Response.json({ url: `/uploads/${folder}/${name}` });
  }

  return json(503, { error: "uploads_not_configured" });
}
