"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  connectTelegramBot,
  inviteToTelegram,
  runRemindersNow,
  saveGiving,
  sendTestEmail,
  telegramAccountStatus,
  type TelegramStatus,
} from "@/app/admin/actions/donors";
import Icon from "@/components/Icon";
import { DAYS_EN, dayName, type GivingSettings } from "@/lib/giving";

type Msg = { ok: boolean; text: string } | null;

function Notice({ msg }: { msg: Msg }) {
  return msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null;
}

export default function GivingSettingsForm({
  initial,
  origin,
  email,
  dueToday,
  telegram,
  invites,
  accountConfigured,
}: {
  initial: GivingSettings;
  origin: string;
  email: { host: string; user: string; from: string; ready: boolean };
  dueToday: number;
  telegram: TelegramStatus;
  /** Donors with an email who aren't on the bot and haven't been invited yet. */
  invites: { withEmail: number };
  accountConfigured: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [amounts, setAmounts] = useState(initial.amounts.join(", "));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [test, setTest] = useState({ to: "", message: "" });
  const [testMsg, setTestMsg] = useState<Msg>(null);
  const [runMsg, setRunMsg] = useState<Msg>(null);
  const [tgMsg, setTgMsg] = useState<Msg>(null);
  const [inviteMsg, setInviteMsg] = useState<Msg>(null);
  const [accountMsg, setAccountMsg] = useState<Msg>(null);

  const invite = (n: number) =>
    confirm(`Email ${n} invitation${n === 1 ? "" : "s"} with each donor's personal Telegram link?`) &&
    start(async () => {
      const res = await inviteToTelegram();
      setInviteMsg(res.ok ? { ok: true, text: `Sent ${res.sent} invitation${res.sent === 1 ? "" : "s"}.` } : { ok: false, text: res.error ?? "Not sent." });
      router.refresh();
    });

  const set = <K extends keyof GivingSettings>(key: K, value: GivingSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="two-col">
      <div>
        <section className="panel">
          <div className="panel__head">
            <h2>Ye-Buna and amounts</h2>
          </div>
          <Notice msg={msg} />
          <div className="a-field">
            <label htmlFor="g-url">Ye-Buna page link</label>
            <input id="g-url" value={form.yebunaUrl} onChange={(e) => set("yebunaUrl", e.target.value)} placeholder="https://ye-buna.com/your-page" />
            <span className="a-hint">
              Create a page at ye-buna.com, then paste its link here. Used for amounts that have no payment link of their own (below), and for one-time gifts.
            </span>
            <span className="a-hint">
              If Ye-Buna lets you set a “thank you” or return link, use <strong>{origin}/thank-you</strong>{" "}
              <a href="/thank-you" target="_blank" rel="noopener">
                (preview)
              </a>
              .
            </span>
          </div>
          <div className="form-grid">
            <div className="a-field">
              <label htmlFor="g-amounts">Suggested weekly amounts (birr)</label>
              <input id="g-amounts" value={amounts} onChange={(e) => setAmounts(e.target.value)} placeholder="50, 100, 250, 500, 1000, 2000, 5000, 10000" />
            </div>
            <div className="a-field">
              <label htmlFor="g-min">Minimum amount (birr)</label>
              <input id="g-min" type="number" min={1} value={form.minAmount} onChange={(e) => set("minAmount", Number(e.target.value))} />
            </div>
            <div className="a-field">
              <label htmlFor="g-day">Default reminder day</label>
              <select id="g-day" value={form.defaultDay} onChange={(e) => set("defaultDay", Number(e.target.value))}>
                {DAYS_EN.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="a-field">
            <label>Ye-Buna payment link for each amount</label>
            <span className="a-hint" style={{ marginBottom: 8 }}>
              Each amount opens its own Ye-Buna payment page (on the Donations page, the thank-you page, and as the {"{link}"} in that donor’s
              reminders). Other amounts use the Ye-Buna page link above. Messages to donors carry the ministry’s own address, such as{" "}
              <code>{origin}/give/250</code>, which forwards to the Ye-Buna link for that amount, so a link changed here also works for messages
              already sent.
            </span>
            {[...new Set(amounts.split(/[,\s]+/).map(Number).filter((n) => n > 0))].map((n) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ minWidth: 92, fontWeight: 600 }}>{n.toLocaleString("en-US")} birr</span>
                <input
                  aria-label={`Ye-Buna link for ${n} birr`}
                  value={form.amountLinks?.[String(n)] ?? ""}
                  onChange={(e) => set("amountLinks", { ...form.amountLinks, [String(n)]: e.target.value })}
                  placeholder={`https://ye-buna.com/pay/…`}
                />
              </div>
            ))}
          </div>
          <label className="a-check">
            <input type="checkbox" checked={form.remindersEnabled} onChange={(e) => set("remindersEnabled", e.target.checked)} /> Send weekly
            reminders automatically by Telegram and email (every day at 9:00 Ethiopian time, to donors whose day it is). Donors with only a
            phone number get theirs as SMS from the Android app’s “Send SMS reminders”.
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.skipIfPaid} onChange={(e) => set("skipIfPaid", e.target.checked)} /> Don’t remind donors who already
            have a payment recorded in the last 6 days
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.telegramEnabled} onChange={(e) => set("telegramEnabled", e.target.checked)} /> Send reminders on
            Telegram to donors who connected the bot
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.telegramReplacesSms} onChange={(e) => set("telegramReplacesSms", e.target.checked)} /> For donors
            reached on Telegram, don’t also send the email
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.telegramUserEnabled} onChange={(e) => set("telegramUserEnabled", e.target.checked)} /> For
            donors who haven’t connected the bot, try the ministry’s Telegram account (by @username or phone) before email
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.welcomeEnabled} onChange={(e) => set("welcomeEnabled", e.target.checked)} /> Send a welcome message
            when someone registers (email on the website; SMS from the phone in the app)
          </label>
          <p className="a-hint">
            The texts of the reminders and welcome messages are on <a href="/admin/messages">Message templates</a>.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="a-btn a-btn--gold"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveGiving({ ...form, amounts: amounts.split(/[,\s]+/).map(Number).filter((n) => n > 0) });
                  setMsg(res.ok ? { ok: true, text: "Saved. The Donations page and messages use the new settings." } : { ok: false, text: res.error ?? "Not saved." });
                  if (res.ok) router.refresh();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                })
              }
            >
              <Icon name="check" /> {pending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>
      </div>

      <aside>
        <section className="panel">
          <div className="panel__head">
            <h2>Email</h2>
          </div>
          <ul className="q-log" style={{ marginTop: 0 }}>
            <li>
              <span>SMTP server (SMTP_HOST)</span>
              <span className={`pill ${email.host ? "pill--ok" : "pill--new"}`}>{email.host || "Missing"}</span>
            </li>
            <li>
              <span>Mailbox (SMTP_USER / SMTP_PASS)</span>
              <span className={`pill ${email.ready ? "pill--ok" : "pill--new"}`}>{email.ready ? email.user : "Missing"}</span>
            </li>
            <li>
              <span>Sent from (EMAIL_FROM)</span>
              <span className="pill">{email.from || "—"}</span>
            </li>
          </ul>
          {!email.ready ? (
            <p className="a-hint" style={{ marginTop: 10 }}>
              Add SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in Vercel → Settings → Environment Variables, then redeploy. With Gmail: smtp.gmail.com,
              port 465, the Gmail address, and an app password (Google Account → Security → 2-Step Verification → App passwords).
            </p>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Telegram bot</h2>
          </div>
          <Notice msg={tgMsg} />
          <ul className="q-log" style={{ marginTop: 0 }}>
            <li>
              <span>Bot token (TELEGRAM_BOT_TOKEN)</span>
              <span className={`pill ${telegram.configured ? "pill--ok" : "pill--new"}`}>{telegram.configured ? "Set" : "Missing"}</span>
            </li>
            <li>
              <span>Bot</span>
              <span className="pill">
                {telegram.bot ? (
                  <a href={`https://t.me/${telegram.bot}`} target="_blank" rel="noopener">
                    @{telegram.bot}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </li>
            <li>
              <span>Connected to this website</span>
              <span className={`pill ${telegram.connected ? "pill--ok" : "pill--new"}`}>{telegram.connected ? "Yes" : "No"}</span>
            </li>
            <li>
              <span>Donors on Telegram</span>
              <span className="pill">{telegram.linkedDonors}</span>
            </li>
          </ul>
          {telegram.lastError ? <p className="a-hint">Last Telegram error: {telegram.lastError}</p> : null}
          {!telegram.configured ? (
            <p className="a-hint" style={{ marginTop: 10 }}>
              Create a bot with @BotFather in Telegram (/newbot), then add its token as TELEGRAM_BOT_TOKEN in Vercel → Settings → Environment
              Variables and redeploy.
            </p>
          ) : (
            <button
              type="button"
              className="a-btn"
              style={{ marginTop: 10 }}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await connectTelegramBot();
                  setTgMsg(res.ok ? { ok: true, text: "Connected. Donors can now press Start on the bot." } : { ok: false, text: res.error ?? "Not connected." });
                  router.refresh();
                })
              }
            >
              <Icon name="send" /> {telegram.connected ? "Reconnect the bot" : "Connect the bot"}
            </button>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Invite donors to Telegram</h2>
          </div>
          <p className="a-hint" style={{ marginBottom: 10 }}>
            A one-time email with each donor’s personal link: one tap in Telegram connects them, and their reminders come there from then on.
            Each donor is only invited once.
          </p>
          <Notice msg={inviteMsg} />
          <button
            type="button"
            className="a-btn a-btn--sm"
            disabled={pending || !telegram.bot || !email.ready || invites.withEmail === 0}
            onClick={() => invite(invites.withEmail)}
          >
            Invite {invites.withEmail} donor{invites.withEmail === 1 ? "" : "s"} by email
          </button>
          {!telegram.bot ? <p className="a-hint" style={{ marginTop: 8 }}>Set up the bot first.</p> : null}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Ministry Telegram account</h2>
          </div>
          <p className="a-hint" style={{ marginBottom: 10 }}>
            Reaches donors who never pressed Start on the bot, by their @username or phone number. Use a dedicated ministry number:
            Telegram limits accounts that message many people, so at most 80 are sent per day, spaced out, and it switches to email if Telegram asks
            to slow down.
          </p>
          <Notice msg={accountMsg} />
          {accountConfigured ? (
            <button
              type="button"
              className="a-btn a-btn--ghost a-btn--sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await telegramAccountStatus();
                  setAccountMsg(
                    res.ok
                      ? { ok: true, text: `Connected as ${res.name}${res.username ? ` (@${res.username})` : ""} ${res.phone ?? ""}.` }
                      : { ok: false, text: res.error ?? "Could not connect." },
                  );
                })
              }
            >
              Check the account connection
            </button>
          ) : (
            <p className="a-hint">
              Not set up. On a computer, run <code>npm run telegram-login</code> in the project folder and add the printed TELEGRAM_API_ID,
              TELEGRAM_API_HASH and TELEGRAM_SESSION in Vercel.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Send a test email</h2>
          </div>
          <Notice msg={testMsg} />
          <div className="a-field">
            <label htmlFor="t-to">Email address</label>
            <input id="t-to" type="email" value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} placeholder="you@example.com" />
          </div>
          <div className="a-field">
            <label htmlFor="t-msg">Message (optional)</label>
            <textarea id="t-msg" rows={2} dir="auto" value={test.message} onChange={(e) => setTest({ ...test, message: e.target.value })} />
          </div>
          <button
            type="button"
            className="a-btn"
            disabled={pending || !email.ready}
            onClick={() =>
              start(async () => {
                const res = await sendTestEmail(test.to, test.message);
                setTestMsg(res.ok ? { ok: true, text: "Sent. Check the inbox (and the spam folder)." } : { ok: false, text: res.error ?? "Not sent." });
                router.refresh();
              })
            }
          >
            <Icon name="send" /> Send test
          </button>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Today’s reminders</h2>
          </div>
          <p className="a-hint" style={{ marginBottom: 10 }}>
            {dueToday} active donor{dueToday === 1 ? "" : "s"} chose {dayName(new Date(Date.now() + 3 * 3_600_000).getUTCDay(), "en")} and haven’t been
            reminded today. They’re sent automatically at 9:00; use this only to send them now.
          </p>
          <Notice msg={runMsg} />
          <button
            type="button"
            className="a-btn a-btn--ghost"
            disabled={pending || (!email.ready && !telegram.connected) || dueToday === 0}
            onClick={() =>
              confirm(`Send today’s reminder to ${dueToday} donor(s) now?`) &&
              start(async () => {
                const run = await runRemindersNow();
                setRunMsg(
                  run.disabled
                    ? { ok: false, text: "Automatic reminders are turned off above." }
                    : {
                        ok: run.failed === 0,
                        text: `Sent ${run.sent} email and ${run.telegram} Telegram, skipped ${run.skippedPaid} (already paid), failed ${run.failed}.${run.phoneOnly ? ` ${run.phoneOnly} with only a phone number: send theirs with “Send SMS reminders” in the app.` : ""}`,
                      },
                );
                router.refresh();
              })
            }
          >
            <Icon name="send" /> Send today’s reminders now
          </button>
        </section>
      </aside>
    </div>
  );
}
