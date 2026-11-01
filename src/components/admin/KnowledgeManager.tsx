"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocumentFile, addDocumentText, clearChatLog, deleteDocument, getDocumentText } from "@/app/admin/actions/knowledge";
import Icon from "@/components/Icon";
import { uploadFile, type UploadMode } from "@/components/admin/upload";

export interface DocRow {
  id: number | null;
  title: string;
  chars: number;
  passages: number;
  created_at: string | null;
}

export interface QuestionRow {
  question: string;
  locale: string;
  created_at: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function KnowledgeManager({
  docs,
  managed,
  questions,
  mode,
}: {
  docs: DocRow[];
  managed: boolean;
  questions: QuestionRow[];
  mode: UploadMode;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paste, setPaste] = useState({ title: "", text: "" });
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);

  const report = (res: { ok: boolean; error?: string; passages?: number }, title: string) => {
    setMsg(res.ok ? { ok: true, text: `Added “${title}” (${res.passages} passages). The assistant can use it right away.` } : { ok: false, text: res.error ?? "Failed." });
    router.refresh();
  };

  const addFiles = async (list: FileList | null) => {
    setMsg(null);
    for (const file of Array.from(list ?? [])) {
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      setBusy(`Reading ${file.name}…`);
      try {
        if (/\.(md|markdown|txt)$/i.test(file.name)) {
          report(await addDocumentText(title, await file.text()), title);
        } else if (/\.(pdf|docx)$/i.test(file.name)) {
          const url = await uploadFile(file, file.name, "knowledge", mode, (p) => setBusy(`Uploading ${file.name}… ${Math.round(p)}%`));
          setBusy(`Extracting text from ${file.name}…`);
          report(await addDocumentFile(url, file.name), title);
        } else {
          setMsg({ ok: false, text: `${file.name}: use PDF, Word (.docx), Markdown or text files.` });
        }
      } catch (err) {
        setMsg({ ok: false, text: `${file.name}: ${err instanceof Error ? err.message : "failed"}` });
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const total = docs.reduce((n, d) => n + d.chars, 0);

  return (
    <div className="two-col">
      <div>
        <section className="panel">
          <div className="panel__head">
            <h2>Documents ({docs.length})</h2>
            <p>{total.toLocaleString()} characters in total</p>
          </div>
          {msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null}
          {!managed && docs.length > 0 ? (
            <p className="notice notice--info">
              These documents come from the website’s <code>knowledge</code> folder. Adding a document here copies them into the dashboard so they can be managed in one place.
            </p>
          ) : null}
          <button type="button" className="dropzone" style={{ width: "100%" }} disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
            <Icon name="arrowUp" />
            <strong>{busy ?? "Upload documents"}</strong>
            <span>PDF, Word (.docx), Markdown or text. Reports, newsletters, FAQs, program descriptions…</span>
          </button>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.md,.markdown,.txt" onChange={(e) => void addFiles(e.target.files)} />

          {docs.length ? (
            <div className="item-list" style={{ marginTop: 14 }}>
              {docs.map((d, i) => (
                <div className="item" key={d.id ?? `f${i}`}>
                  <span className="thumb" style={{ display: "grid", placeItems: "center" }}>
                    <Icon name="book" />
                  </span>
                  <div className="item__main">
                    <strong>{d.title}</strong>
                    <span>
                      {d.chars.toLocaleString()} characters · {d.passages} passages{d.created_at ? ` · added ${day(d.created_at)}` : ""}
                    </span>
                  </div>
                  {d.id !== null ? (
                    <div className="btn-group">
                      <button
                        type="button"
                        className="a-btn a-btn--ghost a-btn--sm"
                        onClick={() => start(async () => setPreview({ title: d.title, text: await getDocumentText(d.id as number) }))}
                      >
                        View text
                      </button>
                      <button
                        type="button"
                        className="a-btn a-btn--danger a-btn--icon"
                        aria-label={`Remove ${d.title}`}
                        disabled={pending}
                        onClick={() =>
                          confirm(`Remove “${d.title}” from the assistant’s knowledge?`) &&
                          start(async () => {
                            await deleteDocument(d.id as number);
                            router.refresh();
                          })
                        }
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">No documents yet. The assistant can only answer from what you add here.</p>
          )}
        </section>

        {preview ? (
          <section className="panel">
            <div className="panel__head">
              <h2>{preview.title}</h2>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <p className="a-hint">This is the text the assistant reads. If it looks garbled, the original file may be a scan.</p>
            <pre className="md-preview" style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto", fontFamily: "inherit" }}>
              {preview.text}
            </pre>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel__head">
            <h2>Add text directly</h2>
            <p>For quick facts: new programs, event dates, answers to common questions.</p>
          </div>
          <div className="a-field">
            <label htmlFor="k-title">Title</label>
            <input id="k-title" value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder="e.g. Frequently asked questions" />
          </div>
          <div className="a-field">
            <label htmlFor="k-text">Text</label>
            <textarea id="k-text" rows={8} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="a-btn a-btn--gold"
              disabled={pending || !paste.title.trim() || paste.text.trim().length < 40}
              onClick={() =>
                start(async () => {
                  const res = await addDocumentText(paste.title, paste.text);
                  report(res, paste.title);
                  if (res.ok) setPaste({ title: "", text: "" });
                })
              }
            >
              <Icon name="check" /> Add to knowledge
            </button>
          </div>
        </section>
      </div>

      <aside>
        <section className="panel">
          <div className="panel__head">
            <h2>Recent questions</h2>
            {questions.length ? (
              <button
                type="button"
                className="a-btn a-btn--ghost a-btn--sm"
                disabled={pending}
                onClick={() =>
                  confirm("Clear the question log?") &&
                  start(async () => {
                    await clearChatLog();
                    router.refresh();
                  })
                }
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="a-hint">What visitors ask the assistant (no names or personal data are stored). Questions it can’t answer show what to add.</p>
          {questions.length ? (
            <ul className="q-log">
              {questions.map((q, i) => (
                <li key={i}>
                  <span className={q.locale === "am" ? "am-text" : undefined}>{q.question}</span>
                  <small>
                    {day(q.created_at)}
                    {q.locale === "am" ? " · አማ" : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No questions yet.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
