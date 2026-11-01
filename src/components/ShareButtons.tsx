"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";
import TelegramIcon from "@/components/TelegramIcon";

export default function ShareButtons({ title, path }: { title: string; path: string }) {
  const t = useTranslations("common");
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  // Resolve the absolute URL on the client so it matches the current host.
  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
  }, [path]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);

  return (
    <div className="share">
      <span className="share__label">{t("share")}</span>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
        <Icon name="facebook" />
      </a>
      <a href={`https://t.me/share/url?url=${u}&text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
        <TelegramIcon />
      </a>
      <a href={`https://wa.me/?text=${text}%20${u}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
        <Icon name="phone" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <Icon name="linkedin" />
      </a>
      <button
        type="button"
        className={copied ? "is-copied" : undefined}
        aria-label={copied ? t("copied") : t("copyLink")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            // Clipboard unavailable — ignore.
          }
        }}
      >
        <Icon name={copied ? "check" : "link"} />
      </button>
    </div>
  );
}
