"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";

export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the text selectable.
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn${copied ? " is-copied" : ""}`}
      onClick={copy}
      aria-label={`${label ?? t("copy")}: ${value}`}
    >
      <Icon name={copied ? "check" : "copy"} />
      <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
    </button>
  );
}
