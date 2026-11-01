"use server";

import path from "node:path";
import { readFile } from "node:fs/promises";
import knowledge from "@/data/knowledge.json";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { chunkText, cleanText, docKind, extractText, titleFromFile } from "@/lib/knowledge-text";

type Result = { ok: boolean; error?: string; passages?: number };

/**
 * The first change in the dashboard switches the chatbot from the bundled
 * knowledge file to the database. Copy the bundled documents across first so
 * nothing the assistant already knows is lost.
 */
async function ensureManaged(): Promise<void> {
  if (await queryOne("select 1 from settings where key = 'knowledge_managed'")) return;
  const kb = knowledge as { docs: { title: string; chars: number }[]; chunks: { doc: string; part: number; text: string }[] };
  for (const doc of kb.docs) {
    const rows = await query<{ id: number }>("insert into knowledge_docs (title, chars) values ($1, $2) returning id", [doc.title, doc.chars]);
    for (const c of kb.chunks.filter((c) => c.doc === doc.title)) {
      await query("insert into knowledge_chunks (doc_id, part, text) values ($1, $2, $3)", [rows[0].id, c.part, c.text]);
    }
  }
  await query("insert into settings (key, data) values ('knowledge_managed', 'true') on conflict (key) do nothing");
}

async function store(title: string, text: string, fileUrl: string | null): Promise<Result> {
  const clean = cleanText(text);
  if (!clean) return { ok: false, error: "No text could be read from this document. (Scanned PDFs need to be converted to text first.)" };
  const parts = chunkText(clean);
  if (parts.length === 0) return { ok: false, error: "The document is too short to be useful." };
  await ensureManaged();
  const rows = await query<{ id: number }>("insert into knowledge_docs (title, file_url, chars) values ($1, $2, $3) returning id", [
    title.slice(0, 160),
    fileUrl,
    clean.length,
  ]);
  for (const [i, t] of parts.entries()) {
    await query("insert into knowledge_chunks (doc_id, part, text) values ($1, $2, $3)", [rows[0].id, i + 1, t]);
  }
  refresh("knowledge");
  return { ok: true, passages: parts.length };
}

async function readUploaded(url: string): Promise<Uint8Array> {
  if (url.startsWith("/uploads/")) {
    const root = path.join(process.cwd(), "public");
    const file = path.normalize(path.join(root, url));
    if (!file.startsWith(path.join(root, "uploads"))) throw new Error("Invalid file path");
    return new Uint8Array(await readFile(file));
  }
  const u = new URL(url);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("Invalid file URL");
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Could not download the file (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** A PDF or Word file already uploaded to storage. */
export async function addDocumentFile(url: string, fileName: string, title?: string): Promise<Result> {
  await requireUser();
  const kind = docKind(fileName);
  if (!kind) return { ok: false, error: "Use a PDF, Word (.docx), Markdown or text file." };
  try {
    const text = await extractText(await readUploaded(url), kind);
    return await store(title?.trim() || titleFromFile(fileName), text, url);
  } catch (err) {
    console.error("knowledge: extract failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not read the document." };
  }
}

/** Plain text, pasted or read from a .md/.txt file in the browser. */
export async function addDocumentText(title: string, text: string): Promise<Result> {
  await requireUser();
  if (!title.trim()) return { ok: false, error: "Give the document a title." };
  return store(title.trim(), text.slice(0, 2_000_000), null);
}

export async function deleteDocument(id: number): Promise<void> {
  await requireUser();
  await ensureManaged();
  await query("delete from knowledge_docs where id = $1", [id]);
  refresh("knowledge");
}

export async function getDocumentText(id: number): Promise<string> {
  await requireUser();
  const rows = await query<{ text: string }>("select text from knowledge_chunks where doc_id = $1 order by part", [id]);
  return rows.map((r) => r.text).join("\n\n— — —\n\n");
}

export async function clearChatLog(): Promise<void> {
  await requireUser();
  await query("delete from chat_logs");
}
