"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVideo, moveVideo, saveVideo, type VideoInput } from "@/app/admin/actions/videos";
import Icon from "@/components/Icon";
import ImageInput from "@/components/admin/ImageInput";
import { uploadFile, videoInfo, type UploadMode } from "@/components/admin/upload";
import { formatDuration, type VideoKind } from "@/lib/videos";

export type VideoRow = Required<VideoInput>;

const KIND_LABEL: Record<VideoKind, string> = {
  film: "Featured film (home page)",
  reel: "Short clip (Stories from the Field)",
  logo: "Logo film (About page)",
};

const EMPTY: VideoInput = {
  kind: "reel",
  src: "",
  preview: "",
  poster: "",
  w: 1280,
  h: 720,
  duration: 0,
  title_en: "",
  title_am: "",
  tag_en: "",
  tag_am: "",
  active: true,
};

export default function VideosManager({ rows, mode }: { rows: VideoRow[]; mode: UploadMode }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<VideoInput | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const pickVideo = async (file: File | undefined) => {
    if (!file || !editing) return;
    setError(null);
    try {
      setProgress(0);
      const info = await videoInfo(file);
      const base = file.name.replace(/\.[^.]+$/, "");
      const src = await uploadFile(file, file.name, "videos", mode, (p) => setProgress(Math.round(p * 0.95)));
      const poster = await uploadFile(info.poster, `${base}-poster.jpg`, "videos", mode);
      setEditing((e) => (e ? { ...e, src, preview: src, poster, w: info.w, h: info.h, duration: info.duration, title_en: e.title_en || base.replace(/[-_]+/g, " ") } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () => {
    if (!editing) return;
    start(async () => {
      const res = await saveVideo(editing);
      if (!res.ok) return setError(res.error ?? "Not saved.");
      setEditing(null);
      setError(null);
      router.refresh();
    });
  };

  const text = (key: "title_en" | "title_am" | "tag_en" | "tag_am", label: string) =>
    editing ? (
      <div className="a-field">
        <label htmlFor={`v-${key}`}>{label}</label>
        <input id={`v-${key}`} className={key.endsWith("_am") ? "am-text" : undefined} value={editing[key]} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
      </div>
    ) : null;

  return (
    <div className="two-col" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)" }}>
      <section className="panel">
        <div className="panel__head">
          <h2>Videos ({rows.length})</h2>
          <button type="button" className="a-btn a-btn--gold a-btn--sm" onClick={() => (setEditing({ ...EMPTY }), setError(null))}>
            + Add video
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="empty">No videos yet. Add one, or import the existing videos from the Overview page.</p>
        ) : (
          <div className="item-list">
            {rows.map((v, i) => (
              <div key={v.id} className={`item${v.active ? "" : " is-hidden"}`}>
                {v.poster ? <img className="thumb" src={v.poster} alt="" /> : <span className="thumb" />}
                <div className="item__main">
                  <strong>{v.title_en}</strong>
                  <span>
                    {KIND_LABEL[v.kind].split(" (")[0]} · {formatDuration(v.duration)}
                    {v.active ? "" : " · hidden"}
                  </span>
                </div>
                <div className="btn-group">
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move up" disabled={i === 0 || pending} onClick={() => run(() => moveVideo(v.id, -1))}>
                    ↑
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move down" disabled={i === rows.length - 1 || pending} onClick={() => run(() => moveVideo(v.id, 1))}>
                    ↓
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => (setEditing({ ...v }), setError(null))}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--icon"
                    aria-label={`Delete ${v.title_en}`}
                    disabled={pending}
                    onClick={() => confirm(`Delete “${v.title_en}”?`) && run(() => deleteVideo(v.id))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="a-hint" style={{ marginTop: 12 }}>
          The first visible “Featured film” plays on the home page; “Short clips” fill the Stories from the Field rail; order here is the order on the site.
        </p>
      </section>

      <aside>
        <section className="panel" style={{ position: "sticky", top: 20 }}>
          {editing ? (
            <>
              <div className="panel__head">
                <h2>{editing.id ? "Edit video" : "Add a video"}</h2>
              </div>
              {error ? <p className="notice notice--error">{error}</p> : null}

              <div className="a-field">
                <span className="a-label">Video file</span>
                {editing.src ? (
                  <video className="media-preview" src={editing.src} poster={editing.poster || undefined} controls preload="metadata" style={{ width: "100%", borderRadius: 10 }} />
                ) : null}
                <button type="button" className="dropzone" style={{ width: "100%" }} disabled={progress !== null || mode === "none"} onClick={() => fileRef.current?.click()}>
                  <Icon name="film" />
                  <strong>{progress !== null ? `Uploading… ${progress}%` : editing.src ? "Replace video" : "Choose an MP4 video"}</strong>
                  <span>MP4 (H.264) plays everywhere. Size, length and a poster frame are read automatically.</span>
                </button>
                {progress !== null ? (
                  <div className="progress" style={{ marginTop: 8 }}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                ) : null}
                <input ref={fileRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => void pickVideo(e.target.files?.[0])} />
              </div>

              <div className="a-field">
                <span className="a-label">Poster image</span>
                <ImageInput value={editing.poster} mode={mode} folder="videos" label="Poster" onChange={(url) => setEditing({ ...editing, poster: url })} />
              </div>

              <div className="a-field">
                <label htmlFor="v-kind">Where it appears</label>
                <select id="v-kind" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as VideoKind })}>
                  {(Object.keys(KIND_LABEL) as VideoKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              {text("title_en", "Title (English)")}
              {text("title_am", "Title (Amharic)")}
              {text("tag_en", "Tag (English), e.g. “Mission trip”")}
              {text("tag_am", "Tag (Amharic)")}
              <label className="a-check" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Show on the website
              </label>
              <div className="form-actions">
                <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending || progress !== null}>
                  <Icon name="check" /> {pending ? "Saving…" : "Save"}
                </button>
                <button type="button" className="a-btn a-btn--ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <Icon name="film" />
              <p>Select “Edit” on a video, or add a new one.</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
