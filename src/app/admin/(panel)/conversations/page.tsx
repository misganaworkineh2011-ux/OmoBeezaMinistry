import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import ConversationList, { type ConversationRow, type TranscriptMessage } from "@/components/admin/ConversationList";

export const metadata = { title: "Conversations" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const VIEWS = {
  review: { label: "Needs review", where: "c.unanswered > 0 and not c.reviewed" },
  unanswered: { label: "Couldn’t answer", where: "c.unanswered > 0" },
  offtopic: {
    label: "Off-topic",
    where: "exists (select 1 from chat_messages m where m.conversation_id = c.id and m.flag = 'off_topic')",
  },
  all: { label: "All", where: "true" },
} as const;
type View = keyof typeof VIEWS;

type Search = Promise<{ view?: string; q?: string; p?: string }>;

export default async function ConversationsPage({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "review";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.p) || 1);

  const search = "($1 = '' or exists (select 1 from chat_messages s where s.conversation_id = c.id and s.content ilike '%' || $1 || '%'))";
  const where = `${VIEWS[view].where} and ${search}`;

  const [rows, total, counts] = await Promise.all([
    query<ConversationRow>(
      `select c.id, c.locale, c.page, c.started_at, c.last_at, c.turns, c.unanswered, c.reviewed
       from chat_conversations c where ${where} order by c.last_at desc limit ${PER_PAGE} offset $2`,
      [q, (page - 1) * PER_PAGE],
    ),
    queryOne<{ n: number }>(`select count(*)::int as n from chat_conversations c where ${where}`, [q]),
    Promise.all(
      (Object.keys(VIEWS) as View[]).map(async (v) => [
        v,
        (await queryOne<{ n: number }>(`select count(*)::int as n from chat_conversations c where ${VIEWS[v].where}`))?.n ?? 0,
      ] as const),
    ),
  ]);

  const messages = rows.length
    ? await query<TranscriptMessage>(
        "select id, conversation_id, role, content, flag, resolved, created_at from chat_messages where conversation_id = any($1::text[]) order by id",
        [rows.map((r) => r.id)],
      )
    : [];
  const byConversation = new Map<string, TranscriptMessage[]>();
  for (const m of messages) byConversation.set(m.conversation_id, [...(byConversation.get(m.conversation_id) ?? []), m]);

  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PER_PAGE));
  const href = (next: { view?: View; p?: number }) => {
    const params = new URLSearchParams();
    params.set("view", next.view ?? view);
    if (q) params.set("q", q);
    if (next.p && next.p > 1) params.set("p", String(next.p));
    return `/admin/conversations?${params.toString()}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Conversations</h1>
          <p>
            What visitors asked the chatbot and what it answered. Questions it couldn’t answer are the best guide to what
            to add to its <Link href="/admin/chatbot">knowledge</Link>: write the answer once and the chatbot will use it
            from then on.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        {counts.map(([v, n]) => (
          <Link key={v} href={href({ view: v })} className={v === view ? "is-active" : undefined}>
            {VIEWS[v].label} {n ? <b>{n}</b> : null}
          </Link>
        ))}
        <form action="/admin/conversations" className="filter-search">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={q} placeholder="Search conversations…" aria-label="Search conversations" />
        </form>
      </div>

      <section className="panel">
        <ConversationList rows={rows.map((r) => ({ ...r, messages: byConversation.get(r.id) ?? [] }))} view={view} />
        {pages > 1 ? (
          <div className="form-actions" style={{ justifyContent: "space-between" }}>
            {page > 1 ? (
              <Link className="a-btn a-btn--ghost a-btn--sm" href={href({ p: page - 1 })}>
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="a-hint">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="a-btn a-btn--ghost a-btn--sm" href={href({ p: page + 1 })}>
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
