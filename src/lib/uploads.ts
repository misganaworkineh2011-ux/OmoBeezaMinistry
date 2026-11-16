import "server-only";
import path from "node:path";

// Where dashboard uploads go:
//  • "disk"      — a folder on this server (UPLOADS_DIR), served at /files/…:
//                  hosting such as Yegara (the startup file sets UPLOADS_DIR).
//  • "blob"      — Vercel Blob with a read-write token (BLOB_READ_WRITE_TOKEN).
//  • "presigned" — Vercel Blob connected the newer way (BLOB_STORE_ID; Vercel
//                  provides the sign-in token automatically).
//  • "local"     — public/uploads on this computer: local development only.
//  • "none"      — production without storage configured: uploads are disabled.
export type UploadMode = "disk" | "blob" | "presigned" | "local" | "none";

export function uploadMode(): UploadMode {
  if (process.env.UPLOADS_DIR) return "disk";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.BLOB_STORE_ID) return "presigned";
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) return "local";
  return "none";
}

/** The uploads folder in "disk" mode (absolute). */
export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"));
}

/** Files in the uploads folder are linked as /files/<folder>/<name>. */
export const FILES_PREFIX = "/files/";

/**
 * The file on disk for a /files/… link, or null when the link points outside
 * the uploads folder (or into its unfinished-uploads area).
 */
export function diskPath(url: string): string | null {
  if (!url.startsWith(FILES_PREFIX)) return null;
  let rel: string;
  try {
    rel = decodeURIComponent(url.slice(FILES_PREFIX.length).split("?")[0]);
  } catch {
    return null;
  }
  const root = uploadsDir();
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) || rel.startsWith(".")) return null;
  return file;
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Content types for files served from disk, by extension. */
export const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/** A safe, unique file name: "My Photo.JPG" → "my-photo-3f9a1c2b.jpg". */
export function safeFileName(name: string, suffix: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base || "file"}-${suffix}${ext}`;
}
