import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { displayPhone, ethiopiaWeekday } from "@/lib/giving";
import { publicOrigin, smsConfig } from "@/lib/sms";
import GivingSettingsForm from "@/components/admin/GivingSettingsForm";

export const metadata = { title: "Giving & SMS" };
export const dynamic = "force-dynamic";
// "Send today's reminders now" runs on this page.
export const maxDuration = 300;

interface LogRow {
  id: number;
  donor_id: number | null;
  name: string | null;
  to_phone: string;
  message: string;
  kind: string;
  status: string;
  error: string;
  created_at: string;
}

export default async function GivingPage() {
  await requireUser();
  const [giving, due, log, totals] = await Promise.all([
    readGivingNow(),
    queryOne<{ n: number }>(
      `select count(*)::int as n from donors where status = 'active' and reminder_day = $1
       and (last_reminded_at is null or last_reminded_at < now() - interval '20 hours')`,
      [ethiopiaWeekday()],
    ),
    query<LogRow>(
      `select l.id, l.donor_id, d.name, l.to_phone, l.message, l.kind, l.status, l.error, l.created_at
       from sms_log l left join donors d on d.id = l.donor_id order by l.created_at desc limit 100`,
    ),
    queryOne<{ sent: number; failed: number }>(
      `select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'failed')::int as failed
       from sms_log where created_at > now() - interval '30 days'`,
    ),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Giving &amp; SMS</h1>
          <p>Weekly giving in birr through Ye-Buna, and the SMS reminders sent with AfroMessage.</p>
        </div>
      </div>

      <GivingSettingsForm initial={giving} origin={publicOrigin()} sms={smsConfig()} dueToday={due?.n ?? 0} />

      <section className="panel">
        <div className="panel__head">
          <h2>SMS log</h2>
          <p>
            Last 30 days: {totals?.sent ?? 0} sent, {totals?.failed ?? 0} failed
          </p>
        </div>
        {log.length === 0 ? (
          <p className="empty">No messages sent yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {log.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {m.donor_id && m.name ? <Link href={`/admin/donors/${m.donor_id}`}>{m.name}</Link> : null}
                      <div className="a-hint">{displayPhone(m.to_phone)}</div>
                    </td>
                    <td>{m.kind}</td>
                    <td>
                      <span className={`pill ${m.status === "sent" ? "pill--ok" : "pill--new"}`}>{m.status}</span>
                    </td>
                    <td dir="auto" style={{ maxWidth: 520 }}>
                      {m.message}
                      {m.error ? <div className="a-hint">{m.error}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
