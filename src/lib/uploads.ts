import "server-only";

// Where dashboard uploads go:
//  • "blob"  — Vercel Blob (BLOB_READ_WRITE_TOKEN set): production.
//  • "local" — public/uploads on this computer: local development only.
//  • "none"  — production without Blob configured: uploads are disabled.
export type UploadMode = "blob" | "local" | "none";

export function uploadMode(): UploadMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) return "local";
  return "none";
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
