"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhotos, deletePhoto, movePhoto, saveAlbum, updateCaption, type AlbumInput } from "@/app/admin/actions/albums";
import Icon from "@/components/Icon";
import MultiUpload from "@/components/admin/MultiUpload";
import type { UploadMode } from "@/components/admin/upload";

export interface PhotoRow {
  id: number;
  src: string;
  w: number;
  h: number;
  caption: string;
}

export default function AlbumEditor({
  album,
  photos,
  icons,
  mode,
}: {
  album: AlbumInput;
  photos: PhotoRow[];
  icons: string[];
  mode: UploadMode;
}) {
  const router = useRouter();
  const [form, setForm] = useState(album);
  const [captions, setCaptions] = useState<Record<number, string>>(() => Object.fromEntries(photos.map((p) => [p.id, p.caption])));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const field = (base: "title" | "tag" | "descr", label: string, multiline = false) => {
    const input = (lang: "en" | "am") => {
      const key = `${base}_${lang}` as const;
      const props = {
        className: `a-input${lang === "am" ? " am-text" : ""}`,
        value: form[key] ?? "",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
      };
      return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
    };
    return (
      <div className="a-field">
        <span className="a-label">{label}</span>
        <div className="ce-pair">
          <label className="ce-lang">
            <span>ENGLISH</span>
            {input("en")}
          </label>
          <label className="ce-lang">
            <span>AMHARIC · አማርኛ</span>
            {input("am")}
          </label>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Album details</h2>
          <a className="a-btn a-btn--ghost a-btn--sm" href={`/gallery/${album.id}`} target="_blank" rel="noopener">
            View on site
          </a>
        </div>
        {field("title", "Title")}
        {field("tag", "Short tag (e.g. “A day of joy”)")}
        {field("descr", "Description", true)}
        <div className="a-field">
          <label htmlFor="album-icon">Icon</label>
          <select id="album-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
            {icons.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="a-btn a-btn--gold"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveAlbum(form);
                setMsg(res.ok ? { ok: true, text: "Album saved." } : { ok: false, text: res.error ?? "Not saved." });
                router.refresh();
              })
            }
          >
            <Icon name="check" /> Save details
          </button>
          {msg ? <span className={`pill ${msg.ok ? "pill--ok" : "pill--new"}`}>{msg.text}</span> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Photos ({photos.length})</h2>
          <p>The first photo is the album cover. Captions appear in the full-screen viewer.</p>
        </div>
        <MultiUpload mode={mode} folder={`albums/${album.id}`} onDone={async (list) => run(() => addPhotos(album.id, list))} />
        {photos.length > 0 ? (
          <div className="media-grid" style={{ marginTop: 16 }}>
            {photos.map((p, i) => (
              <div className="media-tile" key={p.id}>
                <img src={p.src} alt={p.caption} loading="lazy" />
                <span className="media-tile__badge">
                  {i > 0 ? (
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => movePhoto(album.id, p.id, "first"))}>
                      Make cover
                    </button>
                  ) : (
                    <span className="pill pill--blue">Cover</span>
                  )}
                </span>
                <div className="media-tile__body">
                  <input
                    className="a-input"
                    placeholder="Caption (optional)"
                    value={captions[p.id] ?? ""}
                    onChange={(e) => setCaptions({ ...captions, [p.id]: e.target.value })}
                    onBlur={() => (captions[p.id] ?? "") !== p.caption && run(() => updateCaption(p.id, captions[p.id] ?? ""))}
                    aria-label="Caption"
                  />
                  <div className="media-tile__actions">
                    <span className="btn-group">
                      <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move earlier" disabled={i === 0 || pending} onClick={() => run(() => movePhoto(album.id, p.id, -1))}>
                        ←
                      </button>
                      <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move later" disabled={i === photos.length - 1 || pending} onClick={() => run(() => movePhoto(album.id, p.id, 1))}>
                        →
                      </button>
                    </span>
                    <button
                      type="button"
                      className="a-btn a-btn--danger a-btn--icon"
                      aria-label="Delete photo"
                      disabled={pending}
                      onClick={() => confirm("Delete this photo?") && run(() => deletePhoto(p.id))}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
