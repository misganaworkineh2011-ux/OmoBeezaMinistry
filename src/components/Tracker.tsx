"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Privacy-friendly analytics: sends one tiny beacon per page view and per
// click on a "Donate" link. No cookies, nothing stored in the browser.

function send(path: string, event: "view" | "donate_click") {
  const body = JSON.stringify({ path, event });
  if (navigator.sendBeacon?.("/api/track", body)) return;
  fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
}

export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (navigator.webdriver) return; // ignore automated browsers
    send(pathname, "view");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (/\/donations(?:$|[?#])/.test(href)) send(window.location.pathname, "donate_click");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
