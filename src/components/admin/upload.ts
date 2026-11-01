"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";

export type UploadMode = "blob" | "presigned" | "local" | "none";

export interface Uploaded {
  url: string;
  w?: number;
  h?: number;
}

/** Upload one file (Vercel Blob in production, public/uploads locally). Returns its URL. */
export async function uploadFile(
  file: File | Blob,
  name: string,
  folder: string,
  mode: UploadMode,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (mode === "none") throw new Error("Uploads are not configured (connect Vercel Blob).");
  const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");

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
