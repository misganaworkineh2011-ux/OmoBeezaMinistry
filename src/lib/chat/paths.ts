// Website pages the assistant may link to. Shared by the prompt (so Gemini
// only suggests real pages) and the chat renderer (so anything else stays
// plain text instead of becoming a broken link).
export const SITE_PATHS = [
  "/about",
  "/programs",
  "/get-involved",
  "/gallery",
  "/gallery/luka",
  "/gallery/carnival",
  "/gallery/vision",
  "/videos",
  "/stories",
  "/blog",
  "/donations",
  "/careers",
  "/faq",
  "/contact",
] as const;

export function isSitePath(path: string): boolean {
  const bare = path.split("#")[0].replace(/\/+$/, "");
  return (SITE_PATHS as readonly string[]).includes(bare);
}
