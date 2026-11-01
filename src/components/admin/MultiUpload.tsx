"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { prepareImage, uploadFile, type UploadMode } from "@/components/admin/upload";

/** Drag-and-drop / multi-select photo uploader. Calls onDone with the uploaded photos. */
export default function MultiUpload({
  mode,
  folder,
  onDone,
}: {
  mode: UploadMode;
  folder: string;
  onDone: (photos: { src: string; w: number; h: number }[]) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ done: number; total: number; current: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handle = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setErrors([]);
    const uploaded: { src: string; w: number; h: number }[] = [];
    for (const [i, file] of files.entries()) {
      setStatus({ done: i, total: files.length, current: 0 });
      try {
        const img = await prepareImage(file);
        const src = await uploadFile(img.blob, img.name, folder, mode, (p) => setStatus({ done: i, total: files.length, current: p }));
        uploaded.push({ src, w: img.w, h: img.h });
      } catch (err) {
        setErrors((e) => [...e, `${file.name}: ${err instanceof Error ? err.message : "failed"}`]);
      }
    }
    setStatus({ done: files.length, total: files.length, current: 100 });
    if (uploaded.length) await onDone(uploaded);
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const overall = status ? Math.round(((status.done + status.current / 100) / status.total) * 100) : 0;

  return (
    <div>
      <button
        type="button"
        className={`dropzone${over ? " is-over" : ""}`}
        style={{ width: "100%" }}
        disabled={Boolean(status) || mode === "none"}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files);
        }}
      >
        <Icon name="arrowUp" />
        <strong>{status ? `Uploading ${Math.min(status.done + 1, status.total)} of ${status.total}…` : "Drop photos here or click to choose"}</strong>
        <span>JPG, PNG or WebP. Large photos are resized automatically.</span>
      </button>
      {status ? (
        <div className="progress" style={{ marginTop: 8 }}>
          <span style={{ width: `${overall}%` }} />
        </div>
      ) : null}
      {errors.length ? (
        <p className="notice notice--error" style={{ marginTop: 8 }}>
          {errors.join(" · ")}
        </p>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handle(e.target.files)} />
    </div>
  );
}
