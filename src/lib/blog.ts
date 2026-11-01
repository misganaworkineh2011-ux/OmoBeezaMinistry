import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { routing, type Locale } from "@/i18n/routing";
import { query, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";

// Blog posts live in the database (edited in the dashboard). The MDX files in
// content/blog/ are the fallback when no database is configured and the seed
// imported by the dashboard's "Import existing content".

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  cover: string;
  author: string;
  /** Estimated reading time in minutes (~200 words/min). */
  readingMinutes: number;
  /** True when the requested locale was missing and English was used. */
  isFallback: boolean;
}

export interface Post extends PostMeta {
  content: string;
  /** "mdx" for the original files, "md" (plain Markdown, no code) for dashboard posts. */
  format: "md" | "mdx";
}

function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// ---------------------------------------------------------------- files

export async function fileSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Raw frontmatter + body of one language version of a file post (or null). */
export async function readPostFile(locale: string, slug: string): Promise<{ data: Record<string, unknown>; content: string } | null> {
  try {
    const raw = await fs.readFile(path.join(BLOG_DIR, slug, `${locale}.mdx`), "utf8");
    const { data, content } = matter(raw);
    return { data, content };
  } catch {
    return null;
  }
}

async function fileGetPost(locale: Locale, slug: string): Promise<Post | null> {
  let file = await readPostFile(locale, slug);
  let isFallback = false;
  if (!file && locale !== routing.defaultLocale) {
    file = await readPostFile(routing.defaultLocale, slug);
    isFallback = true;
  }
  if (!file) return null;
  const meta = file.data;
  return {
    slug,
    title: str(meta.title, slug),
    date: str(meta.date),
    excerpt: str(meta.excerpt),
    cover: str(meta.cover, "/img/photos/group.jpg"),
    author: str(meta.author, "Omo Beeza Ministry"),
    readingMinutes: readingMinutes(file.content),
    isFallback,
    content: file.content,
    format: "mdx",
  };
}

// ---------------------------------------------------------------- database

interface PostRow {
  slug: string;
  date: string | Date;
  cover: string;
  author: string;
  title_en: string;
  title_am: string;
  excerpt_en: string;
  excerpt_am: string;
  body_en: string;
  body_am: string;
}

function rowToPost(r: PostRow, locale: string): Post {
  const am = locale === "am" && Boolean(r.title_am && r.body_am);
  const content = am ? r.body_am : r.body_en;
  const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
  return {
    slug: r.slug,
    title: am ? r.title_am : r.title_en,
    date,
    excerpt: (am && r.excerpt_am) || r.excerpt_en,
    cover: r.cover || "/img/photos/group.jpg",
    author: r.author,
    readingMinutes: readingMinutes(content),
    isFallback: locale === "am" && !am,
    content,
    format: "md",
  };
}

const readPosts = cached(
  async (): Promise<PostRow[] | null> => {
    const total = await query<{ n: number }>("select count(*)::int as n from posts");
    if ((total[0]?.n ?? 0) === 0) return null;
    return query<PostRow>("select * from posts where published order by date desc, id desc");
  },
  "posts",
  ["posts"],
);

// ---------------------------------------------------------------- public API

export async function getAllSlugs(): Promise<string[]> {
  const rows = await safeRead(readPosts, null);
  return rows ? rows.map((r) => r.slug) : fileSlugs();
}

export async function getPost(locale: Locale, slug: string): Promise<Post | null> {
  const rows = await safeRead(readPosts, null);
  if (!rows) return fileGetPost(locale, slug);
  const row = rows.find((r) => r.slug === slug);
  return row ? rowToPost(row, locale) : null;
}

export async function listPosts(locale: Locale): Promise<PostMeta[]> {
  const rows = await safeRead(readPosts, null);
  const posts = rows
    ? rows.map((r) => rowToPost(r, locale))
    : (await Promise.all((await fileSlugs()).map((slug) => fileGetPost(locale, slug)))).filter((p): p is Post => p !== null);
  return posts.map(({ content: _c, format: _f, ...meta }) => meta).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function formatDate(date: string, locale: string): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}
