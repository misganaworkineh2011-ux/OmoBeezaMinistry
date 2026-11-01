"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, savePost, type PostInput } from "@/app/admin/actions/posts";
import Icon from "@/components/Icon";
import ImageInput from "@/components/admin/ImageInput";
import MarkdownPreview from "@/components/admin/MarkdownPreview";
import { prepareImage, uploadFile, type UploadMode } from "@/components/admin/upload";

type Lang = "en" | "am";

export default function PostEditor({ initial, mode }: { initial: PostInput; mode: UploadMode }) {
  const router = useRouter();
  const [post, setPost] = useState<PostInput>(initial);
  const [lang, setLang] = useState<Lang>("en");
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof PostInput>(key: K, value: PostInput[K]) => {
    setPost((p) => ({ ...p, [key]: value }));
    setMsg(null);
  };
  const bodyKey = lang === "en" ? "body_en" : "body_am";

  /** Wrap the selection (or insert) Markdown in the body textarea. */
  const wrap = (before: string, after = "", placeholder = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const selected = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + selected + after + value.slice(b);
    set(bodyKey, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + selected.length);
    });
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const img = await prepareImage(file);
      const url = await uploadFile(img.blob, img.name, "posts", mode);
      wrap(`\n\n![`, `](${url})\n\n`, "Photo description");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (imgRef.current) imgRef.current.value = "";
    }
  };

  const save = () =>
    start(async () => {
      const res = await savePost(post);
      if (res.ok && res.id) {
        setMsg({ ok: true, text: post.published ? "Saved and published." : "Saved as a draft." });
        if (!post.id) router.replace(`/admin/posts/${res.id}`);
        else router.refresh();
        setPost((p) => ({ ...p, id: res.id }));
      } else setMsg({ ok: false, text: res.error ?? "Not saved." });
    });

  const remove = () => {
    if (!post.id || !confirm("Delete this post permanently?")) return;
    start(async () => {
      await deletePost(post.id as number);
      router.push("/admin/posts");
    });
  };

  return (
    <>
      <div className="two-col" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)" }}>
        <section className="panel">
          <div className="ce-tabs" role="tablist">
            {(["en", "am"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                className={`a-btn a-btn--sm ${lang === l ? "" : "a-btn--ghost"}`}
                onClick={() => setLang(l)}
              >
                {l === "en" ? "English" : "Amharic · አማርኛ"}
              </button>
            ))}
          </div>

          <div className="a-field">
            <label htmlFor="title">Title {lang === "am" ? "(Amharic)" : ""}</label>
            <input
              id="title"
              className={lang === "am" ? "am-text" : undefined}
              value={lang === "en" ? post.title_en : post.title_am}
              onChange={(e) => set(lang === "en" ? "title_en" : "title_am", e.target.value)}
            />
          </div>
          <div className="a-field">
            <label htmlFor="excerpt">Short summary {lang === "am" ? "(Amharic)" : ""}</label>
            <textarea
              id="excerpt"
              rows={2}
              className={lang === "am" ? "am-text" : undefined}
              value={lang === "en" ? post.excerpt_en : post.excerpt_am}
              onChange={(e) => set(lang === "en" ? "excerpt_en" : "excerpt_am", e.target.value)}
            />
          </div>

          <div className="a-field">
            <div className="btn-group" style={{ justifyContent: "space-between" }}>
              <label htmlFor="body">Post text {lang === "am" ? "(Amharic)" : ""}</label>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPreview((p) => !p)}>
                <Icon name="eye" /> {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <MarkdownPreview text={post[bodyKey]} />
            ) : (
              <>
                <div className="md-toolbar">
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("**", "**", "bold text")}>
                    <strong>B</strong>
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("*", "*", "italic")}>
                    <em>I</em>
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("\n\n## ", "\n\n", "Heading")}>
                    Heading
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("\n\n- ", "\n", "List item")}>
                    • List
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("\n\n> ", "\n\n", "Quote or Bible verse")}>
                    “ Quote
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => wrap("[", "](https://)", "link text")}>
                    <Icon name="link" /> Link
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={uploading || mode === "none"} onClick={() => imgRef.current?.click()}>
                    <Icon name="expand" /> {uploading ? "Uploading…" : "Photo"}
                  </button>
                  <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => void insertImage(e.target.files?.[0])} />
                </div>
                <textarea
                  id="body"
                  ref={bodyRef}
                  rows={18}
                  className={lang === "am" ? "am-text" : undefined}
                  value={post[bodyKey]}
                  onChange={(e) => set(bodyKey, e.target.value)}
                  placeholder={lang === "am" ? "Leave blank to show the English version on the Amharic site." : "Write the post here. Leave an empty line between paragraphs."}
                />
              </>
            )}
            <span className="a-hint">Leave an empty line between paragraphs. Use the buttons for headings, lists, quotes, links and photos.</span>
          </div>
        </section>

        <aside>
          <section className="panel">
            <div className="panel__head">
              <h2>Publishing</h2>
            </div>
            <label className="a-check">
              <input type="checkbox" checked={post.published} onChange={(e) => set("published", e.target.checked)} /> Published (visible on the website)
            </label>
            <div className="a-field" style={{ marginTop: 12 }}>
              <label htmlFor="date">Date</label>
              <input id="date" type="date" value={post.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="a-field">
              <label htmlFor="author">Author</label>
              <input id="author" value={post.author} onChange={(e) => set("author", e.target.value)} />
            </div>
            <div className="a-field">
              <label htmlFor="slug">Web address</label>
              <input id="slug" value={post.slug} placeholder="made from the title" onChange={(e) => set("slug", e.target.value)} />
              <span className="a-hint">/blog/{post.slug || "…"}</span>
            </div>
          </section>
          <section className="panel">
            <div className="panel__head">
              <h2>Cover photo</h2>
            </div>
            <ImageInput value={post.cover} onChange={(url) => set("cover", url)} mode={mode} folder="posts" label="Cover" />
          </section>
        </aside>
      </div>

      <div className="sticky-save">
        {msg ? (
          <div className={`notice notice--${msg.ok ? "ok" : "error"}`} style={{ margin: 0 }} role="status">
            <Icon name={msg.ok ? "check" : "info"} /> {msg.text}
          </div>
        ) : null}
        <span className="spacer" />
        {post.id ? (
          <>
            <a className="a-btn a-btn--ghost" href={`/blog/${post.slug}`} target="_blank" rel="noopener">
              View on site
            </a>
            <button type="button" className="a-btn a-btn--danger" onClick={remove} disabled={pending}>
              Delete
            </button>
          </>
        ) : null}
        <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : "Save post"}
        </button>
      </div>
    </>
  );
}
