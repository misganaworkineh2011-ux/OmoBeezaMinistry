"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDonorsForever, emptyRecycleBin, moveDonorsToBin, restoreDonors } from "@/app/admin/actions/donors";
import Icon from "@/components/Icon";

// Toolbar above the Donors table. Rows carry <input data-donor-select value={id}>
// checkboxes and the header a [data-donor-select-all] one; this component
// tracks them and runs the recycle-bin actions on the selection.

const boxes = () => [...document.querySelectorAll<HTMLInputElement>("input[data-donor-select]")];

export default function DonorBulkActions({ mode, binCount, binDays }: { mode: "live" | "bin"; binCount: number; binDays: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const sync = () => {
      const all = boxes();
      const ids = all.filter((b) => b.checked).map((b) => Number(b.value));
      setSelected(ids);
      const head = document.querySelector<HTMLInputElement>("input[data-donor-select-all]");
      if (head) {
        head.checked = all.length > 0 && ids.length === all.length;
        head.indeterminate = ids.length > 0 && ids.length < all.length;
      }
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.matches?.("input[data-donor-select-all]")) boxes().forEach((b) => (b.checked = t.checked));
      if (t.matches?.("input[data-donor-select], input[data-donor-select-all]")) sync();
    };
    document.addEventListener("change", onChange);
    sync();
    return () => document.removeEventListener("change", onChange);
  }, []);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okText: (n: number) => string) =>
    start(async () => {
      const res = await fn();
      setMessage(
        res.ok
          ? {
              ok: !res.error,
              text: [okText(res.count ?? 0), res.error].filter(Boolean).join(" "),
            }
          : { ok: false, text: res.error ?? "Something went wrong." },
      );
      boxes().forEach((b) => (b.checked = false));
      setSelected([]);
      router.refresh();
    });

  const n = selected.length;
  const people = (k: number) => `${k} donor${k === 1 ? "" : "s"}`;

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Selected donors">
      {mode === "live" ? (
        <>
          <span className="a-hint">{n ? `${people(n)} selected` : "Tick donors to move them to the recycle bin."}</span>
          <button
            type="button"
            className="a-btn a-btn--danger a-btn--sm"
            disabled={!n || pending}
            onClick={() =>
              confirm(`Move ${people(n)} to the recycle bin? They stop getting reminders. You can restore them within ${binDays} days.`) &&
              run(
                () => moveDonorsToBin(selected),
                (k) => `${people(k)} moved to the recycle bin.`,
              )
            }
          >
            <Icon name="trash" /> {pending ? "Moving…" : "Move to recycle bin"}
          </button>
        </>
      ) : (
        <>
          <span className="a-hint">{n ? `${people(n)} selected` : `Donors here get no reminders and are deleted for good after ${binDays} days.`}</span>
          <button
            type="button"
            className="a-btn a-btn--ghost a-btn--sm"
            disabled={!n || pending}
            onClick={() =>
              run(
                () => restoreDonors(selected),
                (k) => `${people(k)} restored.`,
              )
            }
          >
            Restore
          </button>
          <button
            type="button"
            className="a-btn a-btn--danger a-btn--sm"
            disabled={!n || pending}
            onClick={() =>
              confirm(`Delete ${people(n)} for good, with their payment history? This can't be undone.`) &&
              run(
                () => deleteDonorsForever(selected),
                (k) => `${people(k)} deleted for good.`,
              )
            }
          >
            Delete forever
          </button>
          <button
            type="button"
            className="a-btn a-btn--danger a-btn--sm"
            style={{ marginLeft: "auto" }}
            disabled={!binCount || pending}
            onClick={() =>
              confirm(`Empty the recycle bin? All ${people(binCount)} in it and their payment history are deleted for good. This can't be undone.`) &&
              run(
                () => emptyRecycleBin(),
                (k) => `Recycle bin emptied (${people(k)}).`,
              )
            }
          >
            Empty recycle bin
          </button>
        </>
      )}
      {message ? (
        <span className={`bulk-bar__msg ${message.ok ? "is-ok" : "is-error"}`} role="status">
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
