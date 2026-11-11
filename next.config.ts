import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// BUILD_TARGET=yegara builds a self-contained server (.next/standalone) for
// cPanel hosting such as Yegara HOST (see `npm run build:yegara`).
const standalone = process.env.BUILD_TARGET === "yegara";

const nextConfig: NextConfig = {
  ...(standalone ? { output: "standalone" as const } : {}),
  // Pin the workspace root (a stray package-lock.json exists in the home dir).
  outputFileTracingRoot: __dirname,
  // The local development database (WebAssembly Postgres) and the document
  // parsers are loaded at runtime rather than bundled.
  serverExternalPackages: ["@electric-sql/pglite", "unpdf", "mammoth", "telegram"],
  // Ship the original blog files with the server so the dashboard's
  // "import existing content" step can read them on Vercel too.
  outputFileTracingIncludes: {
    "/admin": ["./content/blog/**/*"],
  },
  images: {
    // Photos uploaded through the dashboard are stored in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    // IMAGES_UNOPTIMIZED=1 (build time): serve photos as they are, for a host
    // where the image resizer (sharp) can't run.
    unoptimized: process.env.IMAGES_UNOPTIMIZED === "1",
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default withNextIntl(nextConfig);
