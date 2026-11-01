"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useLenis } from "lenis/react";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_ITEMS, isActivePath } from "@/lib/nav";
import { LOGO_SRC, telHref } from "@/lib/site";
import { useSite } from "@/components/SiteProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Socials from "@/components/Socials";
import Icon from "@/components/Icon";

export default function Header() {
  const SITE = useSite();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tt = useTranslations("topbar");
  const pathname = usePathname();
  const lenis = useLenis();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Elevated header once the page scrolls (passive listener + rAF throttle).
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Drawer: Escape closes, focus moves in/out, background scroll is paused.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const opener = openerRef.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
      opener?.focus();
    };
  }, [open, lenis]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <div className="topbar__contacts">
            <a href={`mailto:${SITE.email}`}>
              <Icon name="mail" /> {SITE.email}
            </a>
            <a href={telHref(SITE.phones[0])}>
              <Icon name="phone" /> {SITE.phones[0]}
            </a>
            <span className="topbar__verse">{tt("verse")}</span>
          </div>
          <div className="topbar__right">
            <Link href="/faq">{t("faq")}</Link>
            <Link href="/careers">{t("careers")}</Link>
          </div>
        </div>
      </div>

      <header className={`header${scrolled ? " is-scrolled" : ""}`}>
        <div className="container header__inner">
          <Link href="/" className="brand" aria-label="Omo Beeza Ministry — home">
            <img src={LOGO_SRC} alt="Omo Beeza Ministry" width={168} height={46} />
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="header__actions">
            <LanguageSwitcher />
            <Link href="/donations" className="btn btn--gold btn--sm header__donate">
              <Icon name="heart" /> {t("donate")}
            </Link>
            <button
              ref={openerRef}
              type="button"
              className="burger"
              aria-label={tc("openMenu")}
              aria-expanded={open}
              aria-controls="site-drawer"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div
        id="site-drawer"
        className={`drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={tc("menu")}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="drawer__scrim" onClick={close} />
        <div className="drawer__panel" data-lenis-prevent>
          <div className="drawer__head">
            <span className="footer__logo">
              <img src={LOGO_SRC} alt="Omo Beeza Ministry" width={140} height={38} />
            </span>
            <button ref={closeRef} type="button" className="drawer__close" aria-label={tc("closeMenu")} onClick={close}>
              <Icon name="close" />
            </button>
          </div>

          <nav className="drawer__nav" aria-label="Mobile">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={close}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              >
                {t(item.key)}
                <Icon name="arrowRight" />
              </Link>
            ))}
            <Link href="/careers" onClick={close} aria-current={isActivePath(pathname, "/careers") ? "page" : undefined}>
              {t("careers")}
              <Icon name="arrowRight" />
            </Link>
            <Link href="/faq" onClick={close} aria-current={isActivePath(pathname, "/faq") ? "page" : undefined}>
              {t("faq")}
              <Icon name="arrowRight" />
            </Link>
          </nav>

          <div className="drawer__cta">
            <Link href="/donations" className="btn btn--gold btn--lg btn--block" onClick={close}>
              <Icon name="heart" /> {t("donate")}
            </Link>
          </div>

          <div className="drawer__contact">
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            {SITE.phones.map((p) => (
              <a key={p} href={telHref(p)}>
                {p}
              </a>
            ))}
          </div>

          <div className="drawer__foot">
            <Socials />
            <LanguageSwitcher variant="drawer" />
          </div>
        </div>
      </div>
    </>
  );
}
