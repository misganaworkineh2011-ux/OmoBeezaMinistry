"use server";

import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";

export interface ChildInput {
  id?: number;
  name: string;
  portrait: string;
  portrait_w: number;
  portrait_h: number;
  card: string;
  card_w: number;
  card_h: number;
  active: boolean;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : d);

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `child-${Date.now().toString(36)}`;
}

export async function saveChild(input: ChildInput): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const name = s(input.name, 80);
  const portrait = s(input.portrait, 500);
  if (!name) return { ok: false, error: "Enter the child's name." };
  if (!portrait) return { ok: false, error: "Upload a photo." };
  const card = s(input.card, 500);
  const values = [
    name,
    portrait,
    n(input.portrait_w, 600),
    n(input.portrait_h, 900),
    card || null,
    card ? n(input.card_w, 1280) : null,
    card ? n(input.card_h, 900) : null,
    Boolean(input.active),
  ];

  if (input.id) {
    await query(
      "update children set name=$1, portrait=$2, portrait_w=$3, portrait_h=$4, card=$5, card_w=$6, card_h=$7, active=$8 where id=$9",
      [...values, input.id],
    );
  } else {
    let slug = slugify(name);
    if (await queryOne("select 1 from children where slug = $1", [slug])) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const next = (await queryOne<{ n: number }>("select coalesce(max(sort), -1)::int + 1 as n from children"))?.n ?? 0;
    await query(
      "insert into children (name, portrait, portrait_w, portrait_h, card, card_w, card_h, active, slug, sort) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [...values, slug, next],
    );
  }
  refresh("children");
  return { ok: true };
}

export async function deleteChild(id: number): Promise<void> {
  await requireUser();
  await query("delete from children where id = $1", [id]);
  refresh("children");
}

export async function moveChild(id: number, dir: -1 | 1): Promise<void> {
  await requireUser();
  const rows = await query<{ id: number }>("select id from children order by sort, id");
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [sort, r] of rows.entries()) await query("update children set sort = $1 where id = $2", [sort, r.id]);
  refresh("children");
}
