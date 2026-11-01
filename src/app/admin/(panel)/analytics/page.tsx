import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dailySeries, logSeries, total } from "@/lib/admin/stats";
import BarChart from "@/components/admin/BarChart";
import Icon, { type IconName } from "@/components/Icon";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

const sum = (s: { value: number }[]) => s.reduce((n, d) => n + d.value, 0);

function Bars({ rows, empty }: { rows: { label: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span className="hbar__label">{r.label}</span>
          <strong className="num" style={{ textAlign: "right" }}>
            {r.n.toLocaleString()}
          </strong>
          <span className="hbar__track">
            <span style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser();
  const requested = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;

  const [views, donates, prayers, questions, messages, topPages, topChildren, lang] = await Promise.all([
    dailySeries("view", days),
    dailySeries("donate_click", days),
    logSeries("prayer_log", days),
    logSeries("chat_logs", days),
    total("select count(*)::int as n from submissions where created_at > now() - make_interval(days => $1::int)", [days]),
    query<{ label: string; n: number }>(
      `select path as label, sum(count)::int as n from analytics
       where event = 'view' and day > current_date - $1::int group by path order by n desc limit 12`,
      [days],
    ),
    query<{ label: string; n: number }>(
      `select c.name as label, count(*)::int as n from prayer_log p join children c on c.slug = p.child_slug
       where p.created_at > now() - make_interval(days => $1::int) group by c.name order by n desc limit 10`,
      [days],
    ),
    query<{ label: string; n: number }>(
      `select case when path = '/am' or path like '/am/%' then 'አማርኛ (Amharic)' else 'English' end as label, sum(count)::int as n
       from analytics where event = 'view' and day > current_date - $1::int group by 1 order by n desc`,
      [days],
    ),
  ]);

  const cards: { icon: IconName; value: number; label: string }[] = [
    { icon: "eye", value: sum(views), label: "Page views" },
    { icon: "heart", value: sum(donates), label: "Donate clicks" },
    { icon: "handHeart", value: sum(prayers), label: "Prayers pledged" },
    { icon: "help", value: sum(questions), label: "Chatbot questions" },
    { icon: "mail", value: messages, label: "Form messages" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Privacy-friendly: only daily totals per page are stored. No cookies, no IP addresses.</p>
        </div>
        <div className="filter-bar" style={{ margin: 0 }}>
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/analytics?days=${r}`} className={r === days ? "is-active" : undefined}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="stat-cards">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <span className="stat-card__icon">
              <Icon name={c.icon} />
            </span>
            <strong>{c.value.toLocaleString()}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2>Page views per day</h2>
        </div>
        <BarChart data={views} label={`Page views per day, last ${days} days`} height={180} />
      </section>

      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Prayers per day</h2>
          </div>
          <BarChart data={prayers} label={`Prayers per day, last ${days} days`} color="#d99a2b" />
        </section>
        <section className="panel">
          <div className="panel__head">
            <h2>Donate clicks per day</h2>
          </div>
          <BarChart data={donates} label={`Donate button clicks per day, last ${days} days`} color="#1c7a43" />
        </section>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Top pages</h2>
          </div>
          <Bars rows={topPages} empty="No visits recorded yet." />
        </section>
        <div>
          <section className="panel">
            <div className="panel__head">
              <h2>Most prayed-for children</h2>
            </div>
            <Bars rows={topChildren} empty="No prayers in this period." />
          </section>
          <section className="panel">
            <div className="panel__head">
              <h2>Language</h2>
            </div>
            <Bars rows={lang} empty="No visits recorded yet." />
          </section>
        </div>
      </div>
    </>
  );
}
