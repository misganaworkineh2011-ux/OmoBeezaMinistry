"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAlbum, deleteAlbum, moveAlbum } from "@/app/admin/actions/albums";
import Icon from "@/components/Icon";

export interface AlbumSummary {
  id: string;
  title_en: string;
  icon: string;
  count: number;
  cover: string | null;
}

export default function AlbumsList({ albums }: { albums: AlbumSummary[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      const res = await createAlbum(title);
      if (!res.ok || !res.id) return setError(res.error ?? "Could not create the album.");
      router.push(`/admin/albums/${res.id}`);
    });

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>New album</h2>
        </div>
        {error ? <p className="notice notice--error">{error}</p> : null}
        <div className="btn-group">
          <input
            className="a-input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder="e.g. Christmas Celebration 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            aria-label="Album title"
          />
          <button type="button" className="a-btn a-btn--gold" onClick={create} disabled={pending || !title.trim()}>
            + Create album
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Albums ({albums.length})</h2>
          <p>The “Children of the Luka Site” album is managed under Prayer wall.</p>
        </div>
        {albums.length === 0 ? (
          <p className="empty">No albums yet.</p>
        ) : (
          <div className="item-list">
            {albums.map((a, i) => (
              <div className="item" key={a.id}>
                {a.cover ? <img className="thumb" src={a.cover} alt="" /> : <span className="thumb" />}
                <div className="item__main">
                  <strong>{a.title_en}</strong>
                  <span>
                    {a.count} photo{a.count === 1 ? "" : "s"} · /gallery/{a.id}
                  </span>
                </div>
                <div className="btn-group">
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move up" disabled={i === 0 || pending} onClick={() => run(() => moveAlbum(a.id, -1))}>
                    ↑
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move down" disabled={i === albums.length - 1 || pending} onClick={() => run(() => moveAlbum(a.id, 1))}>
                    ↓
                  </button>
                  <Link className="a-btn a-btn--ghost a-btn--sm" href={`/admin/albums/${a.id}`}>
                    Open
                  </Link>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--icon"
                    aria-label={`Delete ${a.title_en}`}
                    disabled={pending}
                    onClick={() => confirm(`Delete the album “${a.title_en}” and all its photos?`) && run(() => deleteAlbum(a.id))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
