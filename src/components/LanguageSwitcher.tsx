"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import Icon from "@/components/Icon";

const LABELS: Record<string, string> = {
  en: "English",
  am: "አማርኛ",
};

const SHORT: Record<string, string> = {
  en: "EN",
  am: "አማ",
};

export default function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "drawer" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`lang${variant === "drawer" ? " lang--drawer" : ""}`} ref={containerRef}>
      <button
        type="button"
        className="lang__toggle"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${t("language")}: ${LABELS[locale]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="globe" />
        <span>{variant === "drawer" ? LABELS[locale] : SHORT[locale]}</span>
        <Icon name="chevronDown" className="chev" />
      </button>

      {open && (
        <ul className="lang__menu" aria-label={t("language")}>
          {routing.locales.map((loc) => (
            <li key={loc}>
              <Link
                href={pathname}
                locale={loc}
                hrefLang={loc}
                aria-current={loc === locale ? "true" : undefined}
                className={loc === locale ? "active" : undefined}
                onClick={() => setOpen(false)}
              >
                {LABELS[loc]}
                {loc === locale ? <Icon name="check" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
