import { Caveat, Fraunces, Montserrat, Source_Sans_3, Noto_Sans_Ethiopic } from "next/font/google";

// Typography. Loaded once at module level and exposed as CSS variables that
// src/app/globals.css consumes (--font-display / --font-sans / --font-ui).

// Display serif for headings — warm, editorial, and legible at large sizes.
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Brand kit: Montserrat for UI labels/buttons, Source Sans for body copy.
export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

// Amharic glyphs (applied on the `am` locale via the [lang="am"] CSS rule).
export const notoEthiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ethiopic",
  display: "swap",
});

// Handwritten accent for small notes and annotations (Latin only; Amharic
// falls back to Noto Sans Ethiopic).
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-caveat",
  display: "swap",
});
