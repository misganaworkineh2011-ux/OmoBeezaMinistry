import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default withNextIntl(nextConfig);
