"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveMediaBatch } from "@/app/admin/actions/media";
import Icon from "@/components/Icon";

/** Runs the media move in batches until everything is in Blob storage. */
export default function MediaMover({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [left, setLeft] = useState(remaining);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setFailed([]);
    let total = 0;
    try {
      for (let round = 0; round < 200; round++) {
        const res = await moveMediaBatch();
        if (res.error) {
          setError(res.error);
          break;
        }
        total += res.moved;
        setDone(total);
        setLeft(res.remaining);
        if (res.failed.length) setFailed(res.failed);
        if (res.remaining === 0 || res.moved === 0) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again: finished files are kept.");
    }
    setBusy(false);
    router.refresh();
  };

  const all = done + left;

  return (
    <div>
      <button type="button" className="a-btn a-btn--gold" disabled={busy || left === 0} onClick={() => void run()}>
        <Icon name="arrowUp" /> {busy ? `Moving… ${done} of ${all}` : left === 0 ? "All media is in cloud storage" : `Move ${left} files to cloud storage`}
      </button>
      {busy ? (
        <div className="progress" style={{ marginTop: 10 }}>
          <span style={{ width: `${all ? Math.round((done / all) * 100) : 0}%` }} />
        </div>
      ) : null}
      {!busy && done > 0 && left === 0 ? (
        <p className="notice notice--ok" style={{ marginTop: 10 }} role="status">
          <Icon name="check" /> Moved {done} files. Photos and videos are now served from Vercel Blob.
        </p>
      ) : null}
      {error ? <p className="notice notice--error" style={{ marginTop: 10 }}>{error}</p> : null}
      {failed.length ? (
        <p className="notice notice--warn" style={{ marginTop: 10 }}>
          {failed.length} file(s) could not be moved yet: {failed.slice(0, 3).join(" · ")}
          {failed.length > 3 ? " …" : ""}. Click the button again to retry.
        </p>
      ) : null}
    </div>
  );
}
