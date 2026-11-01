// Imports the website's bundled content (children, albums, videos, blog posts,
// chatbot documents, contact settings) into the database in DATABASE_URL.
// Safe to run again: each part is only imported while its table is empty.
//
//   npm run import-content        (reads DATABASE_URL from .env.local)
import { importBundledContent } from "@/lib/admin/import";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

importBundledContent().then(
  (imported) => {
    console.log(imported.length ? `Imported: ${imported.join(", ")}.` : "Everything was already imported.");
    process.exit(0);
  },
  (err: unknown) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
