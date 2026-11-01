import { getKnowledgeIndex } from "@/lib/chat/retrieval";
import { getSite } from "@/lib/data/site";
import { hasDb, query } from "@/lib/db";
import { systemInstruction } from "@/lib/chat/prompt";

// POST /api/chat — the website assistant.
//
// The browser sends the recent conversation; this route picks the relevant
// knowledge passages, asks Gemini (API key stays on the server), and streams
// the answer back as plain text. Guarded by input limits, a per-visitor rate
// limit, and a small cache for repeated first questions.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_BASE = (process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
const MAX_QUESTION = 1000;
const MAX_TURNS = 8;
const RATE = { requests: 15, windowMs: 5 * 60_000 };
const CACHE_TTL = 6 * 60 * 60_000;
const CACHE_MAX = 200;

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

// ---- Per-visitor rate limit (per server instance) ----
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= RATE.windowMs)) hits.delete(key);
  }
  return recent.length > RATE.requests;
}

// ---- Answer cache for first questions (many visitors ask the same things) ----
const cache = new Map<string, { text: string; at: number }>();
let cacheIndex: unknown = null;
function cacheKey(locale: string, question: string): string {
  return `${locale}|${question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseBody(body: unknown): { messages: ChatMessage[]; locale: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { messages, locale } = body as { messages?: unknown; locale?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const clean: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_TURNS)) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, role === "user" ? MAX_QUESTION : 4000);
    if (text) clean.push({ role, content: text });
  }
  // Gemini expects the conversation to start with the user and end with the question.
  while (clean[0]?.role === "assistant") clean.shift();
  if (clean.length === 0 || clean[clean.length - 1].role !== "user") return null;
  return { messages: clean, locale: locale === "am" ? "am" : "en" };
}

function textStream(text: string, headers: Headers): Response {
  return new Response(new TextEncoder().encode(text), { headers });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(503, { error: "not_configured" });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (rateLimited(ip)) return json(429, { error: "rate_limited" });

  let parsed: ReturnType<typeof parseBody>;
  try {
    parsed = parseBody(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return json(400, { error: "bad_request" });
  const { messages, locale } = parsed;

  const question = messages[messages.length - 1].content;
  // Include the previous question so follow-ups ("and how do I give?") retrieve well.
  const previous = [...messages].reverse().find((m, i) => i > 0 && m.role === "user")?.content ?? "";
  const searchText = `${question} ${previous}`;

  const index = await getKnowledgeIndex();
  // Cached answers are only valid for the documents they were made from.
  if (cacheIndex !== index) {
    cache.clear();
    cacheIndex = index;
  }
  // Question log for the dashboard (no personal data is stored).
  if (hasDb()) {
    query("insert into chat_logs (question, locale) values ($1, $2)", [question.slice(0, 1000), locale]).catch(() => {});
  }

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
    "X-Chat-Sources": encodeURIComponent(JSON.stringify(index.topSources(searchText))),
  });

  const key = messages.length === 1 && /[\p{L}\p{N}]/u.test(question) ? cacheKey(locale, question) : null;
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL) return textStream(hit.text, headers);

  const passages = index.retrieve(searchText);
  const site = await getSite();
  const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 1024 };
  // Flash 2.5 models "think" by default; for short grounded answers that's
  // slower and costlier without helping, so turn it off when supported.
  if (/2\.5-flash/.test(MODEL)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_BASE}/v1beta/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction(passages, locale, site) }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig,
        }),
        signal: request.signal,
      },
    );
  } catch (err) {
    console.error("chat: Gemini request failed", err);
    return json(502, { error: "upstream" });
  }
  if (!upstream.ok || !upstream.body) {
    console.error("chat: Gemini responded", upstream.status, await upstream.text().catch(() => ""));
    return json(502, { error: "upstream" });
  }

  // Relay Gemini's server-sent events as a plain text stream.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const event = JSON.parse(line.slice(5)) as {
                candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
              };
              const parts = event.candidates?.[0]?.content?.parts ?? [];
              const text = parts
                .filter((p) => !p.thought)
                .map((p) => p.text ?? "")
                .join("");
              if (text) {
                full += text;
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // Ignore keep-alives / partial lines.
            }
          }
        }
        if (!full.trim()) {
          const fallback =
            locale === "am"
              ? "ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ እንደገና ይሞክሩ።"
              : "Sorry, I couldn't answer that just now. Please try again.";
          controller.enqueue(encoder.encode(fallback));
        } else if (key) {
          if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
          cache.set(key, { text: full, at: Date.now() });
        }
        controller.close();
      } catch (err) {
        if (!request.signal.aborted) console.error("chat: stream error", err);
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, { headers });
}
