import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import InboxList, { type SubmissionRow } from "@/components/admin/InboxList";
import { TYPE_LABEL } from "@/lib/admin/inbox";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

type Search = Promise<{ type?: string; view?: string; open?: string }>;

export default async function InboxPage({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const sp = await searchParams;
  const type = sp.type && sp.type in TYPE_LABEL ? sp.type : "";
  const archived = sp.view === "archived";
  const openId = Number(sp.open) || null;

  const rows = await query<SubmissionRow>(
    `select id, type, name, email, status, data, created_at from submissions
     where ${archived ? "status = 'archived'" : "status <> 'archived'"} and ($1 = '' or type = $1)
     order by created_at desc limit 300`,
    [type],
  );
  const counts = await query<{ type: string; n: number }>(
    "select type, count(*)::int as n from submissions where status = 'new' group by type",
  );
  const unread = Object.fromEntries(counts.map((c) => [c.type, c.n]));
  const totalUnread = counts.reduce((n, c) => n + c.n, 0);

  const href = (t: string, a = archived) => {
    const p = new URLSearchParams();
    if (t) p.set("type", t);
    if (a) p.set("view", "archived");
    const q = p.toString();
    return `/admin/inbox${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Messages sent through the website’s forms. Newsletter sign-ups and donation pledges land here too.</p>
        </div>
        <Link className="a-btn a-btn--ghost a-btn--sm" href={href(type, !archived)}>
          {archived ? "← Back to inbox" : "View archive"}
        </Link>
      </div>

      <div className="filter-bar">
        <Link href={href("")} className={type === "" ? "is-active" : undefined}>
          All {!archived && totalUnread ? <b>{totalUnread}</b> : null}
        </Link>
        {Object.entries(TYPE_LABEL).map(([t, label]) => (
          <Link key={t} href={href(t)} className={type === t ? "is-active" : undefined}>
            {label} {!archived && unread[t] ? <b>{unread[t]}</b> : null}
          </Link>
        ))}
      </div>

      <section className="panel">
        <InboxList rows={rows} openId={openId} />
      </section>
    </>
  );
}
