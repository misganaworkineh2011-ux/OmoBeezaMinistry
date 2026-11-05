import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readGivingNow } from "@/lib/data/giving";
import { displayPhone, ethiopiaWeekday } from "@/lib/giving";
import { emailConfig } from "@/lib/email";
import { publicOrigin } from "@/lib/origin";
import GivingSettingsForm from "@/components/admin/GivingSettingsForm";
import { inviteCounts, telegramStatus } from "@/app/admin/actions/donors";
import { accountConfigured } from "@/lib/telegram-user";

export const metadata = { title: "Giving & reminders" };
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
  channel: string;
  provider_id: string;
}

export default async function GivingPage() {
  await requireUser();
  const [giving, due, log, totals, telegram, invites] = await Promise.all([
    readGivingNow(),
    queryOne<{ n: number }>(
      `select count(*)::int as n from donors where status = 'active' and reminder_day = $1
       and (last_reminded_at is null or last_reminded_at < now() - interval '20 hours')`,
      [ethiopiaWeekday()],
    ),
    query<LogRow>(
      `select l.id, l.donor_id, d.name, l.to_phone, l.message, l.kind, l.status, l.error, l.created_at, l.channel, l.provider_id
       from sms_log l left join donors d on d.id = l.donor_id order by l.created_at desc limit 100`,
    ),
    queryOne<{ sent: number; failed: number }>(
      `select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'failed')::int as failed
       from sms_log where created_at > now() - interval '30 days'`,
    ),
    telegramStatus(),
    inviteCounts(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Giving &amp; reminders</h1>
          <p>Weekly giving in birr through Ye-Buna, and the weekly reminders: Telegram and email (automatic), SMS (from the Android app).</p>
        </div>
      </div>

      <GivingSettingsForm initial={giving} origin={publicOrigin()} email={emailConfig()} dueToday={due?.n ?? 0} telegram={telegram}
        invites={invites}
        accountConfigured={accountConfigured()}
      />

      <section className="panel">
        <div className="panel__head">
          <h2>Message log (email, SMS &amp; Telegram)</h2>
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
                      <div className="a-hint">{m.channel === "telegram" ? "Telegram" : m.channel === "email" ? m.to_phone : displayPhone(m.to_phone)}</div>
                    </td>
                    <td>
                      {m.channel === "telegram" ? "Telegram" : m.channel === "email" ? "Email" : m.provider_id === "phone" ? "SMS (ministry phone)" : "SMS"} · {m.kind}
                    </td>
                    <td>
                      <span className={`pill ${m.status === "sent" ? "pill--ok" : "pill--new"}`}>{m.status}</span>
                    </td>
                    <td dir="auto" style={{ maxWidth: 520, whiteSpace: m.channel === "email" ? "pre-line" : undefined }}>
                      {m.channel === "email" ? m.message.slice(0, 400) : m.message}
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
