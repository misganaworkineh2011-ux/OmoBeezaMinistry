import localFont from "next/font/local";

// Typography. Self-hosted variable fonts (originally from Google Fonts, files
// in src/app/fonts/) so builds never depend on reaching Google. Exposed as CSS
// variables that src/app/globals.css consumes (--font-display / --font-sans /
// --font-ui).

// Display serif for headings — warm, editorial, and legible at large sizes.
export const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/fraunces-italic.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Brand kit: Montserrat for UI labels/buttons, Source Sans for body copy.
export const montserrat = localFont({
  src: "./fonts/montserrat.woff2",
  weight: "500 700",
  variable: "--font-montserrat",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const sourceSans = localFont({
  src: "./fonts/source-sans-3.woff2",
  weight: "400 700",
  variable: "--font-source-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Amharic glyphs (applied on the `am` locale via the [lang="am"] CSS rule;
// Latin characters there fall back to the Latin fonts above).
export const notoEthiopic = localFont({
  src: "./fonts/noto-sans-ethiopic.woff2",
  weight: "400 700",
  variable: "--font-ethiopic",
  display: "swap",
  preload: false,
});

// Handwritten accent for small notes and annotations.
export const caveat = localFont({
  src: "./fonts/caveat.woff2",
  weight: "500 700",
  variable: "--font-caveat",
  display: "swap",
  fallback: ["Segoe Print", "cursive"],
});
