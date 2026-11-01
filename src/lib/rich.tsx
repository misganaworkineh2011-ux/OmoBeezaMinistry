import type { ReactNode } from "react";

// Shared tag map for `t.rich(...)`: lets message strings mark an accent word
// with <em>…</em>, which the design renders as an italic brand-colored phrase.
export const richEm = {
  em: (chunks: ReactNode) => <em>{chunks}</em>,
};
