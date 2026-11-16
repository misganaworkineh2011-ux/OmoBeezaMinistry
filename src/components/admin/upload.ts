"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";

export type UploadMode = "disk" | "blob" | "presigned" | "local" | "none";

export interface Uploaded {
  url: string;
  w?: number;
  h?: number;
}

/** Upload one file (the server's uploads folder, Vercel Blob, or public/uploads locally). Returns its URL. */
export async function uploadFile(
  file: File | Blob,
  name: string,
  folder: string,
  mode: UploadMode,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (mode === "none") throw new Error("Uploads are not configured (set UPLOADS_DIR on the server).");
  const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");

  if (mode === "disk") return diskUpload(file, safe, folder, onProgress);

  if (mode === "blob" || mode === "presigned") {
    const send = mode === "blob" ? upload : uploadPresigned;
    const blob = await send(`${folder}/${safe}`, file, {
      access: "public",
      handleUploadUrl: "/api/admin/upload",
      onUploadProgress: (e) => onProgress?.(e.percentage),
    });
    return blob.url;
  }

  // Local development: post the file with progress events.
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, safe);
    form.append("folder", folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        if (xhr.status === 200 && res.url) resolve(res.url);
        else reject(new Error(res.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

async function api<T>(init: RequestInit & { query?: string }): Promise<T> {
  const res = await fetch(`/api/admin/upload${init.query ?? ""}`, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(body.error ?? `Upload failed (${res.status})`), { status: res.status, body });
  return body;
}

/** Sends the file to the server's uploads folder in pieces, retrying a piece a few times if the connection drops. */
async function diskUpload(file: File | Blob, name: string, folder: string, onProgress?: (percent: number) => void): Promise<string> {
  const type = file.type || (name.endsWith(".md") ? "text/markdown" : name.endsWith(".txt") ? "text/plain" : "");
  const { id, chunk } = await api<{ id: string; chunk: number }>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", name, folder, type, size: file.size }),
  });
  let offset = 0;
  while (offset < file.size) {
    const piece = file.slice(offset, offset + chunk);
    for (let attempt = 1; ; attempt++) {
      try {
        const { received } = await api<{ received: number }>({
          method: "PUT",
          query: `?id=${id}&offset=${offset}`,
          headers: { "Content-Type": "application/octet-stream" },
          body: piece,
        });
        offset = received;
        break;
      } catch (err) {
        const e = err as Error & { status?: number; body?: { received?: number } };
        // The server already has more than we thought: continue from there.
        if (e.status === 409 && typeof e.body?.received === "number") {
          offset = e.body.received;
          break;
        }
        if (attempt >= 4 || (e.status && e.status < 500 && e.status !== 408)) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    onProgress?.(Math.round((offset / file.size) * 100));
  }
  const { url } = await api<{ url: string }>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "finish", id }),
  });
  return url;
}

export function imageSize(file: File | Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Not a readable image"));
    };
    img.src = url;
  });
}

/**
 * Shrink large photos in the browser before uploading (max 2000px, JPEG),
 * which keeps the site fast and storage small. Small images pass through.
 */
export async function prepareImage(file: File, maxSide = 2000): Promise<{ blob: Blob; name: string; w: number; h: number }> {
  const { w, h } = await imageSize(file);
  if (file.type === "image/gif" || (Math.max(w, h) <= maxSide && file.size < 1.5 * 1024 * 1024)) {
    return { blob: file, name: file.name, w, h };
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const bitmap = await createImageBitmap(file);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
  return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", w: canvas.width, h: canvas.height };
}

/** Read a video's size and length, and grab a poster frame as a JPEG. */
export function videoInfo(file: File): Promise<{ w: number; h: number; duration: number; poster: Blob }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video format can't be read by the browser. Please upload an MP4 (H.264)."));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, video.duration / 3 || 0);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error("Could not capture a poster frame"));
          resolve({ w: video.videoWidth, h: video.videoHeight, duration: Math.round(video.duration), poster: blob });
        },
        "image/jpeg",
        0.85,
      );
    };
  });
}
