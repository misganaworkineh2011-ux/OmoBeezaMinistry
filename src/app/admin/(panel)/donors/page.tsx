import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dayName, displayPhone } from "@/lib/giving";
import Icon, { type IconName } from "@/components/Icon";

export const metadata = { title: "Donors" };
export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "Active", where: "d.status = 'active'" },
  unpaid: {
    label: "Not paid in 7 days",
    where: "d.status = 'active' and not exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - 7)",
  },
  paused: { label: "Paused", where: "d.status = 'paused'" },
  stopped: { label: "Stopped", where: "d.status = 'stopped'" },
  all: { label: "All", where: "true" },
} as const;
type View = keyof typeof VIEWS;

interface DonorRow {
  id: number;
  name: string;
  phone: string;
  amount: number;
  reminder_day: number;
  status: string;
  locale: string;
  created_at: string;
  last_paid: string | null;
  total: number;
  last_reminded_at: string | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const birr = (n: number) => `${n.toLocaleString("en-US")} birr`;

export default async function DonorsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "active";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const qDigits = q.replace(/\D/g, "").replace(/^0/, "");

  const [rows, counts, stats] = await Promise.all([
    query<DonorRow>(
      `select d.id, d.name, d.phone, d.amount, d.reminder_day, d.status, d.locale, d.created_at, d.last_reminded_at,
              (select max(p.paid_on) from donor_payments p where p.donor_id = d.id)::text as last_paid,
              (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total
       from donors d
       where ${VIEWS[view].where}
         and ($1 = '' or d.name ilike '%' || $1 || '%' or d.email ilike '%' || $1 || '%' or ($2 <> '' and d.phone like '%' || $2 || '%'))
       order by d.created_at desc limit 500`,
      [q, qDigits],
    ),
    Promise.all(
      (Object.keys(VIEWS) as View[]).map(
        async (v) => [v, (await queryOne<{ n: number }>(`select count(*)::int as n from donors d where ${VIEWS[v].where}`))?.n ?? 0] as const,
      ),
    ),
    queryOne<{ active: number; weekly: number; received30: number; paid7: number; sms7: number }>(
      `select (select count(*)::int from donors where status = 'active') as active,
              (select coalesce(sum(amount), 0)::int from donors where status = 'active') as weekly,
              (select coalesce(sum(amount), 0)::int from donor_payments where paid_on > current_date - 30) as received30,
              (select count(distinct donor_id)::int from donor_payments where paid_on > current_date - 7) as paid7,
              (select count(*)::int from sms_log where status = 'sent' and created_at > now() - interval '7 days') as sms7`,
    ),
  ]);

  const cards: { icon: IconName; value: string; label: string }[] = [
    { icon: "users", value: String(stats?.active ?? 0), label: "Active weekly donors" },
    { icon: "heart", value: (stats?.weekly ?? 0).toLocaleString("en-US"), label: "Birr committed every week" },
    { icon: "check", value: `${stats?.paid7 ?? 0}/${stats?.active ?? 0}`, label: "Paid in the last 7 days" },
    { icon: "bank", value: (stats?.received30 ?? 0).toLocaleString("en-US"), label: "Birr recorded, last 30 days" },
    { icon: "send", value: String(stats?.sms7 ?? 0), label: "SMS sent, last 7 days" },
  ];

  const href = (v: View) => `/admin/donors?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Donors</h1>
          <p>People who committed to give weekly in birr. Record payments as they arrive on Ye-Buna to keep totals up to date.</p>
        </div>
        <div className="btn-group">
          <a className="a-btn a-btn--ghost a-btn--sm" href="/api/admin/donors-export">
            Export CSV
          </a>
          <Link className="a-btn a-btn--gold a-btn--sm" href="/admin/donors/new">
            + Add donor
          </Link>
        </div>
      </div>

      <div className="stat-cards">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <span className="stat-card__icon">
              <Icon name={c.icon} />
            </span>
            <strong>{c.value}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        {counts.map(([v, n]) => (
          <Link key={v} href={href(v)} className={v === view ? "is-active" : undefined}>
            {VIEWS[v].label} {n ? <b>{n}</b> : null}
          </Link>
        ))}
        <form action="/admin/donors" className="filter-search">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={q} placeholder="Search name, phone or email…" aria-label="Search donors" />
        </form>
      </div>

      <section className="panel" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? (
          <p className="empty">
            {view === "active" && !q ? "No weekly donors yet. They appear here when people register on the Donations page." : "No donors match."}
          </p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="num">Weekly</th>
                <th>Reminder</th>
                <th>Status</th>
                <th>Last payment</th>
                <th className="num">Total given</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/admin/donors/${d.id}`}>
                      <strong>{d.name}</strong>
                    </Link>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{displayPhone(d.phone)}</td>
                  <td className="num">{birr(d.amount)}</td>
                  <td>
                    {dayName(d.reminder_day, "en")}
                    {d.locale === "am" ? " · አማ" : ""}
                  </td>
                  <td>
                    <span className={`pill ${d.status === "active" ? "pill--ok" : d.status === "paused" ? "pill--blue" : ""}`}>{d.status}</span>
                  </td>
                  <td>{date(d.last_paid)}</td>
                  <td className="num">{birr(d.total)}</td>
                  <td>{date(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
