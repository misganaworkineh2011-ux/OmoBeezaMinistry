"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSubmission, setStatus, type SubmissionStatus } from "@/app/admin/actions/inbox";
import Icon from "@/components/Icon";
import { TYPE_LABEL } from "@/lib/admin/inbox";

export interface SubmissionRow {
  id: number;
  type: string;
  name: string;
  email: string;
  status: SubmissionStatus;
  created_at: string;
  data: { subject?: string; page?: string; fields?: { label: string; value: string }[] };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function InboxList({ rows, openId }: { rows: SubmissionRow[]; openId: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  if (rows.length === 0) return <p className="empty">Nothing here.</p>;

  const unread = rows.filter((r) => r.status === "new").map((r) => r.id);

  return (
    <>
      {unread.length > 1 ? (
        <div className="form-actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => setStatus(unread, "read"))}>
            <Icon name="check" /> Mark all {unread.length} as read
          </button>
        </div>
      ) : null}
      {rows.map((r) => {
        const subject = r.data.subject || `${TYPE_LABEL[r.type] ?? r.type} form`;
        const reply = r.email ? `mailto:${r.email}?subject=${encodeURIComponent(`Re: ${subject}`)}` : null;
        return (
          <details
            key={r.id}
            className={`inbox-item${r.status === "new" ? " is-new" : ""}`}
            open={r.id === openId}
            onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && r.status === "new" && run(() => setStatus([r.id], "read"))}
          >
            <summary>
              <span className={`pill ${r.status === "new" ? "pill--new" : r.status === "archived" ? "" : "pill--blue"}`}>{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="inbox-item__who">
                <strong>{r.name || r.email || "Anonymous"}</strong>
                <span>{subject}</span>
              </span>
              <span className="a-hint">{when(r.created_at)}</span>
            </summary>
            <div className="inbox-item__body">
              <dl>
                {r.name ? (
                  <>
                    <dt>Name</dt>
                    <dd>{r.name}</dd>
                  </>
                ) : null}
                {r.email ? (
                  <>
                    <dt>Email</dt>
                    <dd>{r.email}</dd>
                  </>
                ) : null}
                {(r.data.fields ?? []).map((f, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
                {r.data.page ? (
                  <>
                    <dt>Sent from</dt>
                    <dd>{r.data.page}</dd>
                  </>
                ) : null}
              </dl>
              <div className="btn-group">
                {reply ? (
                  <a className="a-btn a-btn--gold a-btn--sm" href={reply}>
                    <Icon name="mail" /> Reply
                  </a>
                ) : null}
                {r.status === "read" ? (
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => setStatus([r.id], "new"))}>
                    Mark unread
                  </button>
                ) : null}
                {r.status !== "archived" ? (
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => setStatus([r.id], "archived"))}>
                    Archive
                  </button>
                ) : (
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => run(() => setStatus([r.id], "read"))}>
                    Move to inbox
                  </button>
                )}
                <button
                  type="button"
                  className="a-btn a-btn--danger a-btn--sm"
                  disabled={pending}
                  onClick={() => confirm("Delete this message permanently?") && run(() => deleteSubmission(r.id))}
                >
                  Delete
                </button>
              </div>
            </div>
          </details>
        );
      })}
    </>
  );
}
