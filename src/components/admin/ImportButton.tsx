"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importExistingContent } from "@/app/admin/actions/setup";
import Icon from "@/components/Icon";

export default function ImportButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="a-btn a-btn--gold"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { imported } = await importExistingContent();
            setResult(imported.length ? `Imported: ${imported.join(", ")}.` : "Everything was already imported.");
            router.refresh();
          })
        }
      >
        <Icon name="repeat" /> {pending ? "Importing…" : "Import existing website content"}
      </button>
      {result ? (
        <p className="notice notice--ok" style={{ marginTop: 10 }} role="status">
          <Icon name="check" /> {result}
        </p>
      ) : null}
    </div>
  );
}
