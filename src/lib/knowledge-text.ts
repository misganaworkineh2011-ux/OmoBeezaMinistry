import "server-only";

// Text extraction and passage splitting for chatbot documents uploaded in the
// dashboard. Mirrors scripts/build-knowledge.mjs so both produce the same
// passages.

const CHUNK = 1200;
const OVERLAP = 200;

export type DocKind = "pdf" | "docx" | "text";

export function docKind(name: string): DocKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "md" || ext === "txt" || ext === "markdown") return "text";
  return null;
}

export async function extractText(bytes: Uint8Array, kind: DocKind): Promise<string> {
  if (kind === "text") return new TextDecoder().decode(bytes);
  if (kind === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split on paragraph boundaries into ~1,200-character passages with some overlap. */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).flatMap((p) => (p.length <= CHUNK ? [p] : p.split(/(?<=[.!?።])\s+/)));
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > CHUNK) {
      chunks.push(current);
      current = `${current.slice(-OVERLAP)}\n\n${p}`;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks.map((c) => c.trim()).filter((c) => c.length > 40);
}

export function titleFromFile(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
