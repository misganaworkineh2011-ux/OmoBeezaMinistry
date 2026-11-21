import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dayName, displayPhone, ordinal } from "@/lib/giving";
import Icon, { type IconName } from "@/components/Icon";
import DonorBulkActions from "@/components/admin/DonorBulkActions";
import { BIN_DAYS, purgeRecycleBin } from "@/lib/donors";

export const metadata = { title: "Donors" };
export const dynamic = "force-dynamic";

const LIVE = "d.deleted_at is null";
const VIEWS = {
  active: { label: "Active", where: `${LIVE} and d.status = 'active'` },
  unpaid: {
    label: "Not paid this period",
    // Weekly donors: nothing in the last 7 days; monthly donors: nothing in the last 31.
    where: `${LIVE} and d.status = 'active' and not exists (select 1 from donor_payments p where p.donor_id = d.id and p.paid_on > current_date - (case when d.frequency = 'monthly' then 31 else 7 end))`,
  },
  paused: { label: "Paused", where: `${LIVE} and d.status = 'paused'` },
  stopped: { label: "Stopped", where: `${LIVE} and d.status = 'stopped'` },
  all: { label: "All", where: LIVE },
  bin: { label: "Recycle bin", where: "d.deleted_at is not null" },
} as const;
type View = keyof typeof VIEWS;

interface DonorRow {
  id: number;
  name: string;
  nickname: string;
  phone: string;
  email: string;
  amount: number;
  reminder_day: number;
  frequency: string;
  month_day: number;
  status: string;
  locale: string;
  created_at: string;
  last_paid: string | null;
  total: number;
  last_reminded_at: string | null;
  source: string;
  telegram: boolean;
  deleted_at: string | null;
}

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const birr = (n: number) => `${n.toLocaleString("en-US")} birr`;

export default async function DonorsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "active";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const qDigits = q.replace(/\D/g, "").replace(/^0/, "");
  const inBin = view === "bin";
  // Donors past their time in the bin are deleted for good (the daily cron does this too).
  if (inBin) await purgeRecycleBin().catch(() => 0);

  const [rows, counts, stats] = await Promise.all([
    query<DonorRow>(
      `select d.id, d.name, d.nickname, d.phone, d.email, d.amount, d.reminder_day, d.frequency, d.month_day, d.status, d.locale, d.created_at, d.last_reminded_at, d.source, d.telegram_chat_id is not null as telegram, d.deleted_at,
              (select max(p.paid_on) from donor_payments p where p.donor_id = d.id)::text as last_paid,
              (select coalesce(sum(p.amount), 0)::int from donor_payments p where p.donor_id = d.id) as total
       from donors d
       where ${VIEWS[view].where}
         and ($1 = '' or d.name ilike '%' || $1 || '%' or d.email ilike '%' || $1 || '%' or ($2 <> '' and d.phone like '%' || $2 || '%'))
       order by ${inBin ? "d.deleted_at desc" : "d.created_at desc"} limit 500`,
      [q, qDigits],
    ),
    Promise.all(
      (Object.keys(VIEWS) as View[]).map(
        async (v) => [v, (await queryOne<{ n: number }>(`select count(*)::int as n from donors d where ${VIEWS[v].where}`))?.n ?? 0] as const,
      ),
    ),
    queryOne<{
      active: number;
      weekly: number;
      monthly: number;
      received30: number;
      paid7: number;
      sms7: number;
    }>(
      `select (select count(*)::int from donors where status = 'active' and deleted_at is null) as active,
              (select coalesce(sum(amount), 0)::int from donors where status = 'active' and deleted_at is null and frequency <> 'monthly') as weekly,
              (select coalesce(sum(amount), 0)::int from donors where status = 'active' and deleted_at is null and frequency = 'monthly') as monthly,
              (select coalesce(sum(amount), 0)::int from donor_payments where paid_on > current_date - 30) as received30,
              (select count(distinct donor_id)::int from donor_payments where paid_on > current_date - 7) as paid7,
              (select count(*)::int from sms_log where status = 'sent' and created_at > now() - interval '7 days') as sms7`,
    ),
  ]);

  const cards: { icon: IconName; value: string; label: string }[] = [
    {
      icon: "users",
      value: String(stats?.active ?? 0),
      label: "Active donors",
    },
    {
      icon: "heart",
      value: (stats?.monthly ?? 0).toLocaleString("en-US"),
      label: `Birr a month${stats?.weekly ? `, plus ${stats.weekly.toLocaleString("en-US")} a week` : ""}`,
    },
    {
      icon: "check",
      value: `${stats?.paid7 ?? 0}/${stats?.active ?? 0}`,
      label: "Paid in the last 7 days",
    },
    {
      icon: "bank",
      value: (stats?.received30 ?? 0).toLocaleString("en-US"),
      label: "Birr recorded, last 30 days",
    },
    {
      icon: "send",
      value: String(stats?.sms7 ?? 0),
      label: "Messages sent, last 7 days",
    },
  ];

  const href = (v: View) => `/admin/donors?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Donors</h1>
          <p>People who committed to give monthly or weekly in birr. Record payments as they arrive on Ye-Buna to keep totals up to date.</p>
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
            {inBin && !q
              ? "The recycle bin is empty."
              : view === "active" && !q
                ? "No donors yet. They appear here when people register on the Donations page."
                : "No donors match."}
          </p>
        ) : (
          <>
            <DonorBulkActions mode={inBin ? "bin" : "live"} binCount={counts.find(([v]) => v === "bin")?.[1] ?? 0} binDays={BIN_DAYS} />
            <table className="a-table">
              <thead>
                <tr>
                  <th className="sel">
                    <input type="checkbox" data-donor-select-all aria-label="Select all donors shown" />
                  </th>
                  <th>Name</th>
                  <th>Email / phone</th>
                  <th className="num">Amount</th>
                  <th>Reminder</th>
                  <th>Status</th>
                  <th>Last payment</th>
                  <th className="num">Total given</th>
                  <th>{inBin ? "Moved to bin" : "Since"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="sel">
                      <input type="checkbox" data-donor-select value={d.id} aria-label={`Select ${d.name}`} />
                    </td>
                    <td>
                      <Link href={`/admin/donors/${d.id}`}>
                        <strong>{d.name}</strong>
                      </Link>
                      {d.nickname ? <div className="a-hint">“{d.nickname}”</div> : null}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {d.email || null}
                      {d.phone ? d.email ? <div className="a-hint">{displayPhone(d.phone)}</div> : displayPhone(d.phone) : null}
                    </td>
                    <td className="num">
                      {birr(d.amount)}
                      <div className="a-hint">{d.frequency === "monthly" ? "a month" : "a week"}</div>
                    </td>
                    <td>
                      {d.frequency === "monthly" ? `Monthly, ${ordinal(d.month_day)}` : `Weekly, ${dayName(d.reminder_day, "en")}`}
                      {d.locale === "am" ? " · አማ" : ""}
                    </td>
                    <td>
                      <span className={`pill ${d.status === "active" ? "pill--ok" : d.status === "paused" ? "pill--blue" : ""}`}>{d.status}</span>
                      {d.telegram ? (
                        <span className="pill pill--blue" title="Gets reminders on Telegram" style={{ marginLeft: 4 }}>
                          Telegram ✓
                        </span>
                      ) : null}
                    </td>
                    <td>{date(d.last_paid)}</td>
                    <td className="num">{birr(d.total)}</td>
                    {inBin && d.deleted_at ? (
                      <td>
                        {date(d.deleted_at)}
                        <div className="a-hint">
                          deleted for good in {Math.max(0, BIN_DAYS - Math.floor((Date.now() - new Date(d.deleted_at).getTime()) / 86_400_000))} days
                        </div>
                      </td>
                    ) : (
                      <td>
                        {date(d.created_at)}
                        {d.source === "app" || d.source === "telegram" || d.source === "registrar" ? (
                          <div className="a-hint">via {d.source === "app" ? "the app" : d.source === "registrar" ? "a sub-admin" : "Telegram"}</div>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}
