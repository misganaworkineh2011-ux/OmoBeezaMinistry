import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { isSitePath } from "@/lib/chat/paths";

// Renders the assistant's light Markdown safely (no HTML injection): paragraphs,
// bullet/numbered lists, **bold**, site paths like /donations, URLs and emails.

const INLINE = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.]+|(?<![\w/])\/[a-z][a-z0-9/-]*(?:#[\w-]+)?)/gi;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const k = `${key}-${i++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    } else if (/^https?:/i.test(token)) {
      const clean = token.replace(/[.,;:!?]+$/, "");
      out.push(
        <a key={k} href={clean} target="_blank" rel="noopener noreferrer">
          {clean}
        </a>,
      );
      if (clean.length < token.length) out.push(token.slice(clean.length));
    } else if (token.includes("@")) {
      const clean = token.replace(/[.,;:!?]+$/, "");
      out.push(
        <a key={k} href={`mailto:${clean}`}>
          {clean}
        </a>,
      );
      if (clean.length < token.length) out.push(token.slice(clean.length));
    } else if (isSitePath(token)) {
      out.push(
        <Link key={k} href={token}>
          {token}
        </Link>,
      );
    } else {
      out.push(token); // not a real page: keep as plain text
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)?.[1] ?? "");
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.replace(/^#{1,6}\s+/, ""));
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}
