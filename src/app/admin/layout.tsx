import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { fraunces, montserrat, sourceSans, notoEthiopic } from "@/app/fonts";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Dashboard · Omo Beeza", template: "%s · Omo Beeza Dashboard" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b1f36" };

// The dashboard renders its own document (the public site's [locale] layout
// does not apply here).
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  const fontVars = `${fraunces.variable} ${montserrat.variable} ${sourceSans.variable} ${notoEthiopic.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <body className="admin-body">{children}</body>
    </html>
  );
}
