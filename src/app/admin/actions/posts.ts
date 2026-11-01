"use server";

import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";

export interface PostInput {
  id?: number;
  slug: string;
  date: string;
  cover: string;
  author: string;
  title_en: string;
  title_am: string;
  excerpt_en: string;
  excerpt_am: string;
  body_en: string;
  body_am: string;
  published: boolean;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || `post-${Date.now()}`
  );
}

export async function savePost(input: PostInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  await requireUser();
  const title = s(input.title_en, 200);
  if (!title) return { ok: false, error: "The English title is required." };
  if (!s(input.body_en, 200_000)) return { ok: false, error: "The English post text is required." };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);

  let slug = slugify(s(input.slug, 80) || title);
  const clash = await queryOne<{ id: number }>("select id from posts where slug = $1", [slug]);
  if (clash && clash.id !== input.id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const values = [
    slug,
    date,
    s(input.cover, 500),
    s(input.author, 120) || "Omo Beeza Ministry",
    title,
    s(input.title_am, 200),
    s(input.excerpt_en, 600),
    s(input.excerpt_am, 600),
    s(input.body_en, 200_000),
    s(input.body_am, 200_000),
    Boolean(input.published),
  ];

  let id = input.id;
  if (id) {
    await query(
      `update posts set slug=$1, date=$2, cover=$3, author=$4, title_en=$5, title_am=$6, excerpt_en=$7, excerpt_am=$8,
       body_en=$9, body_am=$10, published=$11, updated_at=now() where id=$12`,
      [...values, id],
    );
  } else {
    const rows = await query<{ id: number }>(
      `insert into posts (slug, date, cover, author, title_en, title_am, excerpt_en, excerpt_am, body_en, body_am, published)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      values,
    );
    id = rows[0].id;
  }
  refresh("posts");
  return { ok: true, id };
}

export async function deletePost(id: number): Promise<void> {
  await requireUser();
  await query("delete from posts where id = $1", [id]);
  refresh("posts");
}
