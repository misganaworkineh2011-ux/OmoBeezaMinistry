"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChild, moveChild, saveChild, type ChildInput } from "@/app/admin/actions/children";
import Icon from "@/components/Icon";
import ImageInput from "@/components/admin/ImageInput";
import type { UploadMode } from "@/components/admin/upload";

export interface ChildRow extends Required<Pick<ChildInput, "id">>, Omit<ChildInput, "id"> {
  slug: string;
  prayers: number;
  recent: number;
}

const EMPTY: ChildInput = { name: "", portrait: "", portrait_w: 600, portrait_h: 900, card: "", card_w: 1280, card_h: 900, active: true };

export default function ChildrenManager({ rows, mode }: { rows: ChildRow[]; mode: UploadMode }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ChildInput | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const save = () => {
    if (!editing) return;
    start(async () => {
      const res = await saveChild(editing);
      if (!res.ok) return setError(res.error ?? "Not saved.");
      setEditing(null);
      setError(null);
      router.refresh();
    });
  };

  return (
    <div className="two-col" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)" }}>
      <section className="panel">
        <div className="panel__head">
          <h2>Children ({rows.length})</h2>
          <button type="button" className="a-btn a-btn--gold a-btn--sm" onClick={() => (setEditing({ ...EMPTY }), setError(null))}>
            + Add child
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="empty">No children yet. Add one, or import the existing prayer wall from the Overview page.</p>
        ) : (
          <div className="item-list">
            {rows.map((c, i) => (
              <div key={c.id} className={`item${c.active ? "" : " is-hidden"}`}>
                <img className="thumb" src={c.portrait} alt="" />
                <div className="item__main">
                  <strong>{c.name}</strong>
                  <span>
                    <Icon name="handHeart" /> {c.prayers} prayer{c.prayers === 1 ? "" : "s"} · {c.recent} in the last 30 days
                    {c.active ? "" : " · hidden"}
                  </span>
                </div>
                <div className="btn-group">
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move up" disabled={i === 0 || pending} onClick={() => run(() => moveChild(c.id, -1))}>
                    ↑
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--icon" aria-label="Move down" disabled={i === rows.length - 1 || pending} onClick={() => run(() => moveChild(c.id, 1))}>
                    ↓
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => (setEditing({ ...c, card: c.card ?? "" }), setError(null))}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--icon"
                    aria-label={`Delete ${c.name}`}
                    disabled={pending}
                    onClick={() => confirm(`Remove ${c.name} from the prayer wall?`) && run(() => deleteChild(c.id))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside>
        <section className="panel" style={{ position: "sticky", top: 20 }}>
          {editing ? (
            <>
              <div className="panel__head">
                <h2>{editing.id ? `Edit ${editing.name}` : "Add a child"}</h2>
              </div>
              {error ? <p className="notice notice--error">{error}</p> : null}
              <div className="a-field">
                <label htmlFor="child-name">Name (as shown on the card)</label>
                <input id="child-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="a-field">
                <span className="a-label">Portrait photo</span>
                <ImageInput
                  value={editing.portrait}
                  mode={mode}
                  folder="children"
                  label="Photo"
                  onChange={(url, size) => setEditing({ ...editing, portrait: url, ...(size ? { portrait_w: size.w, portrait_h: size.h } : {}) })}
                />
                <span className="a-hint">A tall (portrait) photo works best.</span>
              </div>
              <div className="a-field">
                <span className="a-label">Prayer card (optional)</span>
                <ImageInput
                  value={editing.card}
                  mode={mode}
                  folder="children"
                  label="Card"
                  onChange={(url, size) => setEditing({ ...editing, card: url, ...(size ? { card_w: size.w, card_h: size.h } : {}) })}
                />
                <span className="a-hint">Shown when visitors click “View card”.</span>
              </div>
              <label className="a-check" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Show on the website
              </label>
              <div className="form-actions">
                <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending}>
                  <Icon name="check" /> {pending ? "Saving…" : "Save"}
                </button>
                <button type="button" className="a-btn a-btn--ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <Icon name="handHeart" />
              <p>Select “Edit” on a child, or add a new one.</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
