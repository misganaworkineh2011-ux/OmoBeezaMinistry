import type { ReactNode } from "react";

// The locale layout (src/app/[locale]/layout.tsx) renders <html> and <body>
// because the lang attribute depends on the active locale. This root layout
// simply forwards children, per the next-intl App Router pattern.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
