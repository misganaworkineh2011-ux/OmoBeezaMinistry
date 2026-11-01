"use server";

import knowledge from "@/data/knowledge.json";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { DEFAULT_SITE } from "@/lib/site";
import { FILE_MESSAGES, isPlainObject } from "@/lib/messages";
import { FILE_ALBUMS, FILE_ALBUM_ICONS, FILE_CHILDREN } from "@/lib/galleries";
import { FILE_VIDEOS } from "@/lib/videos";
import { fileSlugs, readPostFile } from "@/lib/blog";

const isEmpty = async (table: string) => ((await queryOne<{ n: number }>(`select count(*)::int as n from ${table}`))?.n ?? 0) === 0;

function msg(locale: string, ...path: string[]): string {
  let node: unknown = FILE_MESSAGES[locale];
  for (const key of path) node = isPlainObject(node) ? node[key] : undefined;
  return typeof node === "string" ? node : "";
}

/**
 * Copies the website's current content (bundled files) into the database so
 * it can be edited in the dashboard. Each part is only imported while its
 * table is still empty, so running it again never duplicates anything.
 */
export async function importExistingContent(): Promise<{ imported: string[] }> {
  await requireUser();
  const imported: string[] = [];

  if (!(await queryOne("select 1 from settings where key = 'site'"))) {
    await query("insert into settings (key, data) values ('site', $1)", [JSON.stringify(DEFAULT_SITE)]);
    imported.push("contact settings");
  }

  if (await isEmpty("children")) {
    for (const [i, c] of FILE_CHILDREN.entries()) {
      await query(
        `insert into children (slug, name, portrait, portrait_w, portrait_h, card, card_w, card_h, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [c.slug, c.name, c.portrait.src, c.portrait.w, c.portrait.h, c.card.src, c.card.w, c.card.h, i],
      );
    }
    imported.push(`${FILE_CHILDREN.length} prayer-wall children`);
  }

  if (await isEmpty("albums")) {
    let sort = 0;
    for (const [id, photos] of Object.entries(FILE_ALBUMS)) {
      await query(
        `insert into albums (id, title_en, title_am, tag_en, tag_am, descr_en, descr_am, icon, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          msg("en", "gallery", id, "title") || id,
          msg("am", "gallery", id, "title"),
          msg("en", "gallery", id, "tag"),
          msg("am", "gallery", id, "tag"),
          msg("en", "gallery", id, "descr"),
          msg("am", "gallery", id, "descr"),
          FILE_ALBUM_ICONS[id] ?? "sparkles",
          sort++,
        ],
      );
      for (const [i, p] of photos.entries()) {
        await query("insert into photos (album_id, src, w, h, sort) values ($1, $2, $3, $4, $5)", [id, p.src, p.w, p.h, i]);
      }
    }
    imported.push(`${Object.keys(FILE_ALBUMS).length} photo albums`);
  }

  if (await isEmpty("videos")) {
    for (const [i, v] of FILE_VIDEOS.entries()) {
      await query(
        `insert into videos (id, kind, src, preview, poster, w, h, duration, title_en, title_am, tag_en, tag_am, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          v.id,
          v.kind,
          v.src,
          v.preview,
          v.poster,
          v.w,
          v.h,
          v.duration,
          msg("en", "videos", "items", v.id, "title") || v.id,
          msg("am", "videos", "items", v.id, "title"),
          msg("en", "videos", "items", v.id, "tag"),
          msg("am", "videos", "items", v.id, "tag"),
          i,
        ],
      );
    }
    imported.push(`${FILE_VIDEOS.length} videos`);
  }

  if (await isEmpty("posts")) {
    let n = 0;
    for (const slug of await fileSlugs()) {
      const en = await readPostFile("en", slug);
      if (!en) continue;
      const am = await readPostFile("am", slug);
      const s = (v: unknown) => (typeof v === "string" ? v : "");
      await query(
        `insert into posts (slug, date, cover, author, title_en, title_am, excerpt_en, excerpt_am, body_en, body_am)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          slug,
          s(en.data.date) || new Date().toISOString().slice(0, 10),
          s(en.data.cover),
          s(en.data.author) || "Omo Beeza Ministry",
          s(en.data.title) || slug,
          s(am?.data.title),
          s(en.data.excerpt),
          s(am?.data.excerpt),
          en.content.trim(),
          am?.content.trim() ?? "",
        ],
      );
      n++;
    }
    imported.push(`${n} blog posts`);
  }

  if (!(await queryOne("select 1 from settings where key = 'knowledge_managed'"))) {
    const kb = knowledge as { docs: { title: string; file: string; chars: number }[]; chunks: { doc: string; part: number; text: string }[] };
    for (const doc of kb.docs) {
      const rows = await query<{ id: number }>("insert into knowledge_docs (title, file_url, chars) values ($1, $2, $3) returning id", [
        doc.title,
        null,
        doc.chars,
      ]);
      for (const c of kb.chunks.filter((c) => c.doc === doc.title)) {
        await query("insert into knowledge_chunks (doc_id, part, text) values ($1, $2, $3)", [rows[0].id, c.part, c.text]);
      }
    }
    await query("insert into settings (key, data) values ('knowledge_managed', 'true')");
    imported.push(`${kb.docs.length} chatbot document(s)`);
  }

  refresh("settings", "children", "albums", "videos", "posts", "knowledge");
  return { imported };
}
