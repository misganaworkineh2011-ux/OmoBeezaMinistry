"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { prepareImage, uploadFile, type UploadMode } from "@/components/admin/upload";

/** An image field: preview + "Upload" button + editable URL. */
export default function ImageInput({
  value,
  onChange,
  mode,
  folder,
  label = "Image",
}: {
  value: string;
  onChange: (url: string, size?: { w: number; h: number }) => void;
  mode: UploadMode;
  folder: string;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const img = await prepareImage(file);
      const url = await uploadFile(img.blob, img.name, folder, mode, setProgress);
      onChange(url, { w: img.w, h: img.h });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="image-input">
      <span className="image-input__preview" style={{ backgroundImage: value ? `url("${value}")` : undefined }} aria-hidden="true" />
      <span className="image-input__side">
        <span className="btn-group">
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => fileRef.current?.click()} disabled={progress !== null || mode === "none"}>
            <Icon name="arrowUp" /> {progress !== null ? `Uploading ${progress}%` : `Upload ${label.toLowerCase()}`}
          </button>
          {value ? (
            <a className="a-btn a-btn--ghost a-btn--sm" href={value} target="_blank" rel="noopener">
              View
            </a>
          ) : null}
        </span>
        <input className="a-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="/img/… or https://…" aria-label={`${label} URL`} />
        {error ? <span className="a-hint" style={{ color: "var(--a-red)" }}>{error}</span> : null}
      </span>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
