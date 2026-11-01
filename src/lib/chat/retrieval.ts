import "server-only";
import knowledge from "@/data/knowledge.json";
import { query, queryOne, safeRead } from "@/lib/db";
import { cached } from "@/lib/data/cache";

// Keyword retrieval (BM25) over the chatbot's knowledge passages. Passages come
// from the database (documents uploaded in the dashboard) or, before the
// dashboard has been set up, from src/data/knowledge.json (built from the
// knowledge/ folder). Small knowledge bases are sent to the model whole;
// larger ones are narrowed to the passages that best match the question.

export interface Passage {
  id: string;
  doc: string;
  part: number;
  text: string;
}

/**
 * Send everything when the whole knowledge base is at most this large (~60
 * pages). Whole-corpus answers are the most reliable — including Amharic
 * questions about English documents, which share no keywords — and Gemini
 * caches the repeated prefix, so this stays cheap.
 */
const SEND_ALL_UNDER = 150_000;
/** Otherwise, send the best-matching passages up to this many characters. */
const BUDGET = 40_000;

const FILE_PASSAGES = (knowledge as { chunks: Passage[] }).chunks;

const readPassages = cached(
  async (): Promise<Passage[] | null> => {
    // The dashboard marks the knowledge base as managed once documents are
    // imported/uploaded; until then the bundled file passages are used.
    const managed = await queryOne("select 1 from settings where key = 'knowledge_managed'");
    if (!managed) return null;
    const rows = await query<{ id: number; doc: string; part: number; text: string }>(
      "select c.id, d.title as doc, c.part, c.text from knowledge_chunks c join knowledge_docs d on d.id = c.doc_id order by d.id, c.part",
    );
    return rows.map((r) => ({ id: String(r.id), doc: r.doc, part: r.part, text: r.text }));
  },
  "knowledge",
  ["knowledge"],
);

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i in is it its me my of on or our so that the their them there they this to was we what when where which who why will with you your about tell please".split(
    " ",
  ),
);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => !STOP.has(w) && (w.length > 1 || /\p{Script=Ethiopic}/u.test(w)))
    .map((w) => (/^[a-z]+$/.test(w) && w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

/** A BM25 index over one set of passages (rebuilt only when the set changes). */
class KnowledgeIndex {
  private readonly tokens: string[][];
  private readonly avgLen: number;
  private readonly docFreq = new Map<string, number>();
  private readonly totalChars: number;

  constructor(readonly passages: Passage[]) {
    this.tokens = passages.map((p) => tokenize(`${p.doc} ${p.text}`));
    this.avgLen = this.tokens.reduce((n, t) => n + t.length, 0) / Math.max(1, this.tokens.length);
    for (const tokens of this.tokens) {
      for (const term of new Set(tokens)) this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
    }
    this.totalChars = passages.reduce((n, p) => n + p.text.length, 0);
  }

  private score(q: string[], i: number): number {
    const tokens = this.tokens[i] ?? [];
    const k1 = 1.4;
    const b = 0.75;
    let score = 0;
    for (const term of new Set(q)) {
      const df = this.docFreq.get(term);
      if (!df) continue;
      let tf = 0;
      for (const t of tokens) if (t === term) tf++;
      if (!tf) continue;
      const idf = Math.log(1 + (this.passages.length - df + 0.5) / (df + 0.5));
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens.length) / this.avgLen));
    }
    return score;
  }

  /** Up to `max` document titles that best match the question (shown as sources). */
  topSources(question: string, max = 2): string[] {
    const q = tokenize(question);
    const best = new Map<string, number>();
    this.passages.forEach((p, i) => {
      const s = this.score(q, i);
      if (s > 0 && s > (best.get(p.doc) ?? 0)) best.set(p.doc, s);
    });
    return [...best.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([doc]) => doc);
  }

  /** Passages to give the model for this question, in document order. */
  retrieve(question: string): Passage[] {
    if (this.totalChars <= SEND_ALL_UNDER) return this.passages;
    const q = tokenize(question);
    const ranked = this.passages.map((p, i) => ({ p, i, score: this.score(q, i) })).sort((a, b) => b.score - a.score);
    // No keyword overlap, e.g. a question in Afaan Oromoo or French about
    // documents written in English: give the model as much as fits, in order.
    if ((ranked[0]?.score ?? 0) <= 0) {
      const picked: Passage[] = [];
      let used = 0;
      for (const p of this.passages) {
        if (used + p.text.length > BUDGET && picked.length >= 3) break;
        picked.push(p);
        used += p.text.length;
      }
      return picked;
    }
    const picked: { p: Passage; i: number }[] = [];
    let used = 0;
    for (const { p, i, score } of ranked) {
      if (picked.length >= 3 && score <= 0) break;
      if (used + p.text.length > BUDGET && picked.length >= 3) break;
      picked.push({ p, i });
      used += p.text.length;
    }
    return picked.sort((a, b) => a.i - b.i).map(({ p }) => p);
  }
}

let current: { passages: Passage[]; index: KnowledgeIndex } | null = null;

export async function getKnowledgeIndex(): Promise<KnowledgeIndex> {
  const passages = (await safeRead(readPassages, null)) ?? FILE_PASSAGES;
  if (!current || current.passages !== passages) current = { passages, index: new KnowledgeIndex(passages) };
  return current.index;
}
