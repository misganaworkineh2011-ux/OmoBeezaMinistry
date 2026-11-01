"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetContent, saveContent } from "@/app/admin/actions/content";
import Icon from "@/components/Icon";
import ImageInput from "@/components/admin/ImageInput";
import type { UploadMode } from "@/components/admin/upload";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
type Path = (string | number)[];

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

// Values that are the same in both languages (identifiers, images, icons…).
const SHARED_KEYS = new Set(["icon", "image", "cover", "href", "id", "w", "h", "value", "suffix", "stat"]);
const IMAGE_KEYS = new Set(["image", "cover", "poster", "photo"]);

function isShared(key: string | number, en: Json, am: Json): boolean {
  if (typeof key === "string" && SHARED_KEYS.has(key)) return true;
  if (typeof en === "number" || typeof en === "boolean") return true;
  // Identifier-like values that are identical in both languages (e.g. tag: "family").
  return typeof en === "string" && en === am && /^[a-z0-9/_.#:-]{1,60}$/.test(en);
}

function humanize(key: string | number): string {
  if (typeof key === "number") return `Item ${key + 1}`;
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function itemTitle(item: Json, i: number): string {
  if (isObj(item)) {
    for (const k of ["title", "q", "label", "caption", "name", "when", "id"]) {
      const v = item[k];
      if (typeof v === "string" && v.trim()) return v.length > 60 ? `${v.slice(0, 60)}…` : v;
    }
  }
  if (typeof item === "string" && item.trim()) return item.length > 60 ? `${item.slice(0, 60)}…` : item;
  return `Item ${i + 1}`;
}

function getIn(root: Json, path: Path): Json {
  let node: Json = root;
  for (const p of path) {
    if (Array.isArray(node)) node = node[p as number];
    else if (isObj(node)) node = node[p as string];
    else return undefined as unknown as Json;
  }
  return node;
}

function setIn(root: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setIn(copy[head as number] ?? null, rest, value);
    return copy;
  }
  const obj = isObj(root) ? root : {};
  return { ...obj, [head as string]: setIn(obj[head as string] ?? null, rest, value) };
}

/** Make Amharic mirror English's structure (missing pieces start blank). */
function align(en: Json, am: Json): Json {
  if (Array.isArray(en)) {
    const arr = Array.isArray(am) ? am : [];
    return en.map((v, i) => align(v, arr[i] as Json));
  }
  if (isObj(en)) {
    const obj = isObj(am) ? am : {};
    return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, align(v, obj[k] as Json)]));
  }
  if (am === undefined || am === null) return typeof en === "string" ? "" : en;
  return am;
}

/** A blank copy of an item, used when adding to a list. */
function blankLike(sample: Json, key?: string): Json {
  if (typeof sample === "string") return key === "icon" ? sample : "";
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  if (Array.isArray(sample)) return [];
  if (isObj(sample)) return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, blankLike(v, k)]));
  return "";
}

interface EditorProps {
  ns: string;
  initialEn: Obj;
  initialAm: Obj;
  edited: boolean;
  icons: string[];
  mode: UploadMode;
}

export default function ContentEditor({ ns, initialEn, initialAm, edited, icons, mode }: EditorProps) {
  const router = useRouter();
  const [en, setEn] = useState<Json>(initialEn);
  const [am, setAm] = useState<Json>(() => align(initialEn, initialAm));
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; list?: string[] } | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (lang: "en" | "am" | "both", path: Path, value: Json) => {
    if (lang !== "am") setEn((prev) => setIn(prev, path, value));
    if (lang !== "en") setAm((prev) => setIn(prev, path, value));
    setDirty(true);
    setMessage(null);
  };

  /** Structural edits (add/remove/move list items) apply to both languages. */
  const mutateList = (path: Path, fn: (list: Json[]) => Json[]) => {
    setEn((prev) => setIn(prev, path, fn([...((getIn(prev, path) as Json[]) ?? [])])));
    setAm((prev) => setIn(prev, path, fn([...((getIn(prev, path) as Json[]) ?? [])])));
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveContent(ns, en, am);
      if (res.ok) {
        setDirty(false);
        setMessage({ kind: "ok", text: "Saved. The website has been updated." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: "Not saved — please fix these:", list: res.errors });
      }
    });

  const reset = () => {
    if (!confirm("Discard all dashboard edits for this section and restore the original text?")) return;
    start(async () => {
      await resetContent(ns);
      setDirty(false);
      router.refresh();
      window.location.reload();
    });
  };

  const iconOptions = useMemo(() => icons.slice().sort(), [icons]);

  // ---- Renderers ----

  const renderLeaf = (key: string | number, path: Path, enVal: Json, amVal: Json, parent: Obj | null) => {
    const label = (
      <span className="ce-leaf__label">
        {humanize(key)}
        {typeof enVal === "string" && enVal.includes("<em>") ? <code>wrap words in &lt;em&gt;…&lt;/em&gt; for the gold/italic accent</code> : null}
        {typeof enVal === "string" && /\{[a-z]+/i.test(enVal) ? <code>keep {"{…}"} placeholders unchanged</code> : null}
      </span>
    );

    if (key === "icon" && typeof enVal === "string") {
      return (
        <div className="ce-leaf" key={path.join(".")}>
          {label}
          <select className="a-input" value={enVal} onChange={(e) => update("both", path, e.target.value)}>
            {[...new Set([enVal, ...iconOptions])].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      );
    }

    const looksLikeImage =
      typeof enVal === "string" &&
      ((typeof key === "string" && IMAGE_KEYS.has(key)) || /^(\/(img|media|uploads)\/|https?:\/\/.*\.(jpe?g|png|webp|gif))/i.test(enVal));
    if (looksLikeImage) {
      return (
        <div className="ce-leaf" key={path.join(".")}>
          {label}
          <ImageInput
            value={String(enVal)}
            mode={mode}
            folder="content"
            onChange={(url, size) => {
              update("both", path, url);
              // Keep width/height next to the image in sync when present.
              if (size && parent && "w" in parent && "h" in parent) {
                const base = path.slice(0, -1);
                update("both", [...base, "w"], size.w);
                update("both", [...base, "h"], size.h);
              }
            }}
          />
        </div>
      );
    }

    if (typeof enVal === "number") {
      return (
        <div className="ce-leaf" key={path.join(".")}>
          {label}
          <input className="a-input" type="number" value={enVal} onChange={(e) => update("both", path, Number(e.target.value))} />
        </div>
      );
    }

    if (typeof enVal === "boolean") {
      return (
        <label className="a-check" key={path.join(".")}>
          <input type="checkbox" checked={enVal} onChange={(e) => update("both", path, e.target.checked)} /> {humanize(key)}
        </label>
      );
    }

    const enText = typeof enVal === "string" ? enVal : "";
    const amText = typeof amVal === "string" ? amVal : "";
    if (isShared(key, enVal, amVal)) {
      return (
        <div className="ce-leaf" key={path.join(".")}>
          {label}
          <input className="a-input" value={enText} onChange={(e) => update("both", path, e.target.value)} />
        </div>
      );
    }

    const long = enText.length > 70 || amText.length > 70 || enText.includes("\n");
    const Field = long ? "textarea" : "input";
    return (
      <div className="ce-leaf" key={path.join(".")}>
        {label}
        <div className="ce-pair">
          <label className="ce-lang">
            <span>ENGLISH</span>
            <Field className="a-input" value={enText} rows={long ? 3 : undefined} onChange={(e) => update("en", path, e.target.value)} />
          </label>
          <label className="ce-lang">
            <span>AMHARIC · አማርኛ</span>
            <Field
              className="a-input am-text"
              value={amText}
              placeholder={enText ? `(uses English if blank) ${enText.slice(0, 50)}` : ""}
              rows={long ? 3 : undefined}
              onChange={(e) => update("am", path, e.target.value)}
            />
          </label>
        </div>
      </div>
    );
  };

  const renderNode = (key: string | number, path: Path, enVal: Json, amVal: Json, parent: Obj | null, depth: number): React.ReactNode => {
    if (Array.isArray(enVal)) {
      const amArr = Array.isArray(amVal) ? amVal : [];
      return (
        <details className={`ce-node${depth > 0 ? " ce-node--nested" : ""}`} key={path.join(".")} open={depth > 0}>
          <summary>
            {humanize(key)} <span className="pill">{enVal.length}</span>
          </summary>
          <div className="ce-node__body">
            {enVal.map((item, i) => (
              <div className="ce-item" key={i}>
                <div className="ce-item__bar">
                  <span>{itemTitle(item, i)}</span>
                  <span className="btn-group">
                    <button
                      type="button"
                      className="a-btn a-btn--ghost a-btn--icon"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => mutateList(path, (l) => ([l[i - 1], l[i]] = [l[i], l[i - 1]], l))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="a-btn a-btn--ghost a-btn--icon"
                      aria-label="Move down"
                      disabled={i === enVal.length - 1}
                      onClick={() => mutateList(path, (l) => ([l[i + 1], l[i]] = [l[i], l[i + 1]], l))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="a-btn a-btn--danger a-btn--icon"
                      aria-label="Remove"
                      onClick={() => confirm("Remove this item?") && mutateList(path, (l) => l.filter((_, j) => j !== i))}
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                </div>
                {isObj(item) ? (
                  <div className="ce-node__body" style={{ marginTop: 0 }}>
                    {Object.keys(item).map((k) =>
                      renderNode(k, [...path, i, k], item[k], isObj(amArr[i]) ? (amArr[i] as Obj)[k] : undefined as unknown as Json, item, depth + 1),
                    )}
                  </div>
                ) : (
                  renderNode(i, [...path, i], item, amArr[i], null, depth + 1)
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                className="a-btn a-btn--ghost a-btn--sm"
                onClick={() => mutateList(path, (l) => [...l, blankLike(enVal[enVal.length - 1] ?? "")])}
              >
                + Add item
              </button>
            </div>
          </div>
        </details>
      );
    }
    if (isObj(enVal)) {
      const amObj = isObj(amVal) ? amVal : {};
      return (
        <details className={`ce-node${depth > 0 ? " ce-node--nested" : ""}`} key={path.join(".")} open={depth > 0}>
          <summary>{humanize(key)}</summary>
          <div className="ce-node__body">
            {Object.keys(enVal).map((k) => renderNode(k, [...path, k], enVal[k], amObj[k] as Json, enVal, depth + 1))}
          </div>
        </details>
      );
    }
    return renderLeaf(key, path, enVal, amVal, parent);
  };

  const root = isObj(en) ? en : {};
  const amRoot = isObj(am) ? am : {};
  const topLeaves = Object.keys(root).filter((k) => !isObj(root[k]) && !Array.isArray(root[k]));
  const topGroups = Object.keys(root).filter((k) => isObj(root[k]) || Array.isArray(root[k]));

  return (
    <>
      {topLeaves.length > 0 ? (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="ce-node__body" style={{ marginTop: 0 }}>
            {topLeaves.map((k) => renderLeaf(k, [k], root[k], amRoot[k] as Json, root))}
          </div>
        </div>
      ) : null}
      {topGroups.map((k) => renderNode(k, [k], root[k], amRoot[k] as Json, root, 0))}

      <div className="sticky-save">
        {message ? (
          <div className={`notice notice--${message.kind === "ok" ? "ok" : "error"}`} role="status" style={{ margin: 0 }}>
            <Icon name={message.kind === "ok" ? "check" : "info"} />
            <span>
              {message.text}
              {message.list ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {message.list.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </span>
          </div>
        ) : (
          <span className="a-hint">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
        )}
        <span className="spacer" />
        {edited ? (
          <button type="button" className="a-btn a-btn--danger" onClick={reset} disabled={pending}>
            Restore original
          </button>
        ) : null}
        <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending || !dirty}>
          <Icon name="check" /> {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
