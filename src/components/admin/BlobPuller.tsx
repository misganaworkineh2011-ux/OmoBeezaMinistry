"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pullBlobBatch } from "@/app/admin/actions/blob-to-disk";
import Icon from "@/components/Icon";

/** Copies the files still linked in Vercel Blob onto this server, in batches, until none are left. */
export default function BlobPuller({ remaining }: { remaining: number }) {
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
      for (let round = 0; round < 300; round++) {
        const res = await pullBlobBatch();
        if (res.error) {
          setError(res.error);
          break;
        }
        total += res.copied;
        setDone(total);
        setLeft(res.remaining);
        setFailed(res.failed);
        if (res.remaining === 0 || (res.copied === 0 && res.failed.length)) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Click again: files already copied are kept.");
    }
    setBusy(false);
    router.refresh();
  };

  const all = done + left;

  return (
    <div>
      <button type="button" className="a-btn a-btn--gold" disabled={busy || left === 0} onClick={() => void run()}>
        <Icon name="arrowUp" /> {busy ? `Copying… ${done} of ${all}` : left === 0 ? "All files are on this server" : `Copy ${left} files to this server`}
      </button>
      {busy ? (
        <div className="progress" style={{ marginTop: 10 }}>
          <span style={{ width: `${all ? Math.round((done / all) * 100) : 0}%` }} />
        </div>
      ) : null}
      {!busy && done > 0 && left === 0 ? (
        <p className="notice notice--ok" style={{ marginTop: 10 }} role="status">
          <Icon name="check" /> Copied {done} files. Photos, videos and documents are now served from this server.
        </p>
      ) : null}
      {error ? <p className="notice notice--error" style={{ marginTop: 10 }}>{error}</p> : null}
      {failed.length ? (
        <p className="notice notice--warn" style={{ marginTop: 10 }}>
          {failed.length} file(s) could not be copied: {failed.slice(0, 3).join(" · ")}
          {failed.length > 3 ? " …" : ""}. Click the button again to retry.
        </p>
      ) : null}
    </div>
  );
}
