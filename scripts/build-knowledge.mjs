// Builds the chatbot's knowledge base from the documents in /knowledge.
//
//   knowledge/*.pdf | *.docx | *.md | *.txt   →   src/data/knowledge.json
//
// Each document's text is extracted, cleaned, and split into overlapping
// passages (~1,200 characters) that the /api/chat route searches to find the
// parts relevant to a question. Files whose names start with "_" and README
// files are ignored. Runs before `npm run dev` / `npm run build`.
//
//   node scripts/build-knowledge.mjs
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "knowledge");
const OUT = path.join(ROOT, "src", "data", "knowledge.json");
const CHUNK = 1200;
const OVERLAP = 200;

async function extract(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".md" || ext === ".txt") return readFile(file, "utf8");
  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(file)));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ path: file });
    return value;
  }
  return null;
}

function clean(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split on paragraph boundaries into ~CHUNK-sized passages with some overlap. */
function chunk(text) {
  const paragraphs = text.split(/\n{2,}/).flatMap((p) => {
    if (p.length <= CHUNK) return [p];
    // Very long paragraph: split on sentence ends (Latin or Ethiopic "።").
    return p.split(/(?<=[.!?።])\s+/);
  });
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > CHUNK) {
      chunks.push(current);
      current = current.slice(-OVERLAP) + "\n\n" + p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks.map((c) => c.trim()).filter((c) => c.length > 40);
}

function titleFrom(file) {
  return path
    .parse(file)
    .name.replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const files = existsSync(SOURCE)
    ? (await readdir(SOURCE)).filter((f) => !f.startsWith("_") && !/^readme/i.test(f) && !f.startsWith("."))
    : [];

  const docs = [];
  const chunks = [];
  for (const file of files.sort()) {
    let text;
    try {
      text = await extract(path.join(SOURCE, file));
    } catch (err) {
      console.warn(`knowledge: could not read ${file}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (text === null) continue; // unsupported type
    text = clean(text);
    if (!text) {
      console.warn(`knowledge: ${file} has no extractable text (scanned PDF?) — skipped`);
      continue;
    }
    const title = titleFrom(file);
    const parts = chunk(text);
    docs.push({ title, file, chars: text.length, chunks: parts.length });
    parts.forEach((t, i) => chunks.push({ id: `${chunks.length}`, doc: title, part: i + 1, text: t }));
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify({ docs, chunks })}\n`);
  const total = docs.reduce((n, d) => n + d.chars, 0);
  console.log(`knowledge: ${docs.length} document(s), ${chunks.length} passages, ${total.toLocaleString()} characters`);
}

await main();
