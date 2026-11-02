"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDonor, deletePayment, recordPayment, saveDonor, smsDonor, type DonorInput } from "@/app/admin/actions/donors";
import Icon from "@/components/Icon";
import { DAYS_EN, DONOR_STATUSES, smsSegments } from "@/lib/giving";

export interface PaymentRow {
  id: number;
  amount: number;
  paid_on: string;
  reference: string;
  note: string;
  created_by: string;
}

export interface SmsRow {
  id: number;
  message: string;
  kind: string;
  status: string;
  error: string;
  created_at: string;
}

const today = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function DonorEditor({
  donor,
  payments,
  sms,
  reminderPreview,
  smsReady,
}: {
  donor: DonorInput;
  payments: PaymentRow[];
  sms: SmsRow[];
  reminderPreview: string;
  smsReady: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(donor);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pay, setPay] = useState({ amount: String(donor.amount), date: today(), reference: "", note: "" });
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [custom, setCustom] = useState("");
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = payments.reduce((n, p) => n + p.amount, 0);
  const set = <K extends keyof DonorInput>(key: K, value: DonorInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    start(async () => {
      const res = await saveDonor(form);
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Not saved." });
      setMsg({ ok: true, text: "Saved." });
      if (!donor.id && res.id) router.push(`/admin/donors/${res.id}`);
      else router.refresh();
    });

  return (
    <div className="two-col">
      <div>
        <section className="panel">
          <div className="panel__head">
            <h2>Details</h2>
          </div>
          {msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null}
          <div className="form-grid">
            <div className="a-field">
              <label htmlFor="dn-name">Name</label>
              <input id="dn-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="a-field">
              <label htmlFor="dn-phone">Mobile number</label>
              <input id="dn-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="09…" />
            </div>
            <div className="a-field">
              <label htmlFor="dn-email">Email (optional)</label>
              <input id="dn-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="a-field">
              <label htmlFor="dn-amount">Weekly amount (birr)</label>
              <input id="dn-amount" type="number" min={1} value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} />
            </div>
            <div className="a-field">
              <label htmlFor="dn-day">Reminder day</label>
              <select id="dn-day" value={form.reminder_day} onChange={(e) => set("reminder_day", Number(e.target.value))}>
                {DAYS_EN.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="a-field">
              <label htmlFor="dn-locale">SMS language</label>
              <select id="dn-locale" value={form.locale} onChange={(e) => set("locale", e.target.value)}>
                <option value="en">English</option>
                <option value="am">Amharic (አማርኛ)</option>
              </select>
            </div>
            <div className="a-field">
              <label htmlFor="dn-status">Status</label>
              <select id="dn-status" value={form.status} onChange={(e) => set("status", e.target.value as DonorInput["status"])}>
                {DONOR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === "active" ? "Active (gets reminders)" : st === "paused" ? "Paused (no reminders)" : "Stopped"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="a-field">
            <label htmlFor="dn-notes">Notes (only visible to admins)</label>
            <textarea id="dn-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending}>
              <Icon name="check" /> {pending ? "Saving…" : donor.id ? "Save changes" : "Add donor"}
            </button>
            {donor.id ? (
              <button
                type="button"
                className="a-btn a-btn--danger a-btn--sm"
                style={{ marginLeft: "auto" }}
                disabled={pending}
                onClick={() =>
                  confirm(`Delete ${donor.name} and their payment history? To keep the history, set the status to Stopped instead.`) &&
                  start(async () => {
                    await deleteDonor(donor.id as number);
                    router.push("/admin/donors");
                  })
                }
              >
                Delete donor
              </button>
            ) : null}
          </div>
        </section>

        {donor.id ? (
          <section className="panel">
            <div className="panel__head">
              <h2>Payments ({payments.length})</h2>
              <p>{total.toLocaleString("en-US")} birr in total</p>
            </div>
            <p className="a-hint" style={{ marginBottom: 12 }}>
              Ye-Buna doesn’t notify the website, so record gifts here when you see them in your Ye-Buna account (or bank).
            </p>
            {payMsg ? <p className={`notice ${payMsg.ok ? "notice--ok" : "notice--error"}`}>{payMsg.text}</p> : null}
            <div className="form-grid">
              <div className="a-field">
                <label htmlFor="pay-amount">Amount (birr)</label>
                <input id="pay-amount" type="number" min={1} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              </div>
              <div className="a-field">
                <label htmlFor="pay-date">Received on</label>
                <input id="pay-date" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
              </div>
              <div className="a-field">
                <label htmlFor="pay-ref">Reference (optional)</label>
                <input id="pay-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Ye-Buna / transaction ID" />
              </div>
              <div className="a-field">
                <label htmlFor="pay-note">Note (optional)</label>
                <input id="pay-note" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="a-btn"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await recordPayment(donor.id as number, Number(pay.amount), pay.date, pay.reference, pay.note);
                    setPayMsg(res.ok ? { ok: true, text: "Payment recorded." } : { ok: false, text: res.error ?? "Not saved." });
                    if (res.ok) {
                      setPay({ amount: String(form.amount), date: today(), reference: "", note: "" });
                      router.refresh();
                    }
                  })
                }
              >
                <Icon name="check" /> Record payment
              </button>
            </div>

            {payments.length ? (
              <table className="a-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Amount</th>
                    <th>Reference</th>
                    <th>Recorded by</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{date(p.paid_on)}</td>
                      <td className="num">{p.amount.toLocaleString("en-US")} birr</td>
                      <td>
                        {p.reference}
                        {p.note ? <span className="a-hint"> · {p.note}</span> : null}
                      </td>
                      <td>{p.created_by}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="a-btn a-btn--danger a-btn--icon"
                          aria-label="Delete payment"
                          disabled={pending}
                          onClick={() =>
                            confirm("Delete this payment record?") &&
                            start(async () => {
                              await deletePayment(p.id);
                              router.refresh();
                            })
                          }
                        >
                          <Icon name="close" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ) : null}
      </div>

      {donor.id ? (
        <aside>
          <section className="panel">
            <div className="panel__head">
              <h2>Send an SMS</h2>
            </div>
            {!smsReady ? <p className="notice notice--warn">SMS is not configured yet. See Giving &amp; SMS.</p> : null}
            {smsMsg ? <p className={`notice ${smsMsg.ok ? "notice--ok" : "notice--error"}`}>{smsMsg.text}</p> : null}
            <div className="a-field">
              <label htmlFor="sms-text">Message</label>
              <textarea
                id="sms-text"
                rows={4}
                dir="auto"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={`Leave empty to send their weekly reminder:\n\n${reminderPreview}`}
              />
              <span className="a-hint">
                {(() => {
                  const info = smsSegments(custom || reminderPreview);
                  return `${info.chars} characters · ${info.segments} SMS${info.unicode ? " (Amharic/Unicode: 70 per SMS)" : ""}`;
                })()}
              </span>
            </div>
            <button
              type="button"
              className="a-btn a-btn--gold"
              disabled={pending || !smsReady}
              onClick={() =>
                start(async () => {
                  const res = await smsDonor(donor.id as number, custom);
                  setSmsMsg(res.ok ? { ok: true, text: "SMS sent." } : { ok: false, text: res.error ?? "Not sent." });
                  if (res.ok) setCustom("");
                  router.refresh();
                })
              }
            >
              <Icon name="send" /> {custom.trim() ? "Send message" : "Send weekly reminder now"}
            </button>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>SMS history</h2>
            </div>
            {sms.length === 0 ? (
              <p className="empty">No messages yet.</p>
            ) : (
              <ul className="q-log">
                {sms.map((m) => (
                  <li key={m.id} style={{ display: "block" }}>
                    <span className={`pill ${m.status === "sent" ? "pill--ok" : "pill--new"}`}>{m.status}</span>{" "}
                    <small>
                      {m.kind} · {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </small>
                    <p dir="auto" style={{ margin: "6px 0 0" }}>
                      {m.message}
                    </p>
                    {m.error ? <p className="a-hint">{m.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      ) : null}
    </div>
  );
}
