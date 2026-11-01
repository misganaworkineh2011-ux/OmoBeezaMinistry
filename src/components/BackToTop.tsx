"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLenis } from "lenis/react";
import { Link, usePathname } from "@/i18n/navigation";
import Icon from "@/components/Icon";

const R = 26;
const C = 2 * Math.PI * R;

// Floating "back to top" button with a scroll-progress ring, plus a sticky
// "Donate" bar on small screens (hidden on the donation page itself).
export default function BackToTop() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const lenis = useLenis();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? window.scrollY / max : 0);
        setVisible(window.scrollY > 600);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {pathname !== "/donations" ? (
        <div className={`mobile-give${visible ? " is-visible" : ""}`}>
          <Link href="/donations" className="btn btn--gold" tabIndex={visible ? undefined : -1}>
            <Icon name="heart" /> {t("giveNow")}
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        className={`to-top${visible ? " is-visible" : ""}`}
        aria-label={t("backToTop")}
        onClick={toTop}
        tabIndex={visible ? undefined : -1}
      >
        <svg className="to-top__ring" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <Icon name="arrowUp" />
      </button>
    </>
  );
}
