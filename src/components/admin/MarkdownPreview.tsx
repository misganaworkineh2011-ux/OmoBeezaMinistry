import type { ReactNode } from "react";

// A small, safe Markdown preview for the post editor (headings, paragraphs,
// lists, quotes, images, **bold**, *italic*, [links](url)). No HTML is injected.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("![")) {
      const [, alt, src] = t.match(/!\[([^\]]*)\]\(([^)]+)\)/) ?? [];
      out.push(<img key={k} src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: 8 }} />);
    } else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/) ?? [];
      out.push(
        <a key={k} href={href} target="_blank" rel="noopener">
          {label}
        </a>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = start + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function MarkdownPreview({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const paragraphs = text.replace(/\r/g, "").split(/\n{2,}/);
  paragraphs.forEach((block, b) => {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return;
    const k = `b${b}`;
    const first = lines[0];
    const heading = first.match(/^(#{1,4})\s+(.*)$/);
    if (heading && lines.length === 1) {
      const level = Math.min(4, heading[1].length + 1);
      const Tag = `h${level}` as "h2";
      blocks.push(<Tag key={k}>{inline(heading[2], k)}</Tag>);
    } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      blocks.push(
        <ul key={k}>
          {lines.map((l, i) => (
            <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${k}-${i}`)}</li>
          ))}
        </ul>,
      );
    } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      blocks.push(
        <ol key={k}>
          {lines.map((l, i) => (
            <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${k}-${i}`)}</li>
          ))}
        </ol>,
      );
    } else if (lines.every((l) => l.startsWith(">"))) {
      blocks.push(<blockquote key={k}>{inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), k)}</blockquote>);
    } else {
      blocks.push(<p key={k}>{inline(lines.join(" "), k)}</p>);
    }
  });
  return <div className="md-preview">{blocks.length ? blocks : <p className="a-hint">Nothing to preview yet.</p>}</div>;
}
