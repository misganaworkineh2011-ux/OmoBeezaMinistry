"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  connectTelegramBot,
  inviteToTelegram,
  runRemindersNow,
  saveGiving,
  sendTestSms,
  telegramAccountStatus,
  type TelegramStatus,
} from "@/app/admin/actions/donors";
import Icon from "@/components/Icon";
import { DAYS_EN, dayName, fillTemplate, smsSegments, type GivingSettings } from "@/lib/giving";

type Msg = { ok: boolean; text: string } | null;
const TEMPLATES = [
  { key: "reminderEn", label: "Weekly reminder · English", locale: "en" },
  { key: "reminderAm", label: "Weekly reminder · Amharic", locale: "am" },
  { key: "welcomeEn", label: "Welcome message · English", locale: "en" },
  { key: "welcomeAm", label: "Welcome message · Amharic", locale: "am" },
] as const;

function Notice({ msg }: { msg: Msg }) {
  return msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null;
}

export default function GivingSettingsForm({
  initial,
  origin,
  sms,
  dueToday,
  telegram,
  invites,
  accountConfigured,
}: {
  initial: GivingSettings;
  origin: string;
  sms: { token: boolean; identifier: boolean; sender: string };
  dueToday: number;
  telegram: TelegramStatus;
  /** Donors not on the bot and not yet invited: with a username / all. */
  invites: { withUsername: number; all: number };
  accountConfigured: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [amounts, setAmounts] = useState(initial.amounts.join(", "));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [test, setTest] = useState({ phone: "", message: "" });
  const [testMsg, setTestMsg] = useState<Msg>(null);
  const [runMsg, setRunMsg] = useState<Msg>(null);
  const [tgMsg, setTgMsg] = useState<Msg>(null);
  const [inviteMsg, setInviteMsg] = useState<Msg>(null);
  const [accountMsg, setAccountMsg] = useState<Msg>(null);

  const invite = (scope: "username" | "all", n: number) =>
    confirm(`Send ${n} SMS invitation${n === 1 ? "" : "s"} with each donor's personal Telegram link?`) &&
    start(async () => {
      const res = await inviteToTelegram(scope);
      setInviteMsg(res.ok ? { ok: true, text: `Sent ${res.sent} invitation${res.sent === 1 ? "" : "s"}.` } : { ok: false, text: res.error ?? "Not sent." });
      router.refresh();
    });

  const set = <K extends keyof GivingSettings>(key: K, value: GivingSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const sample = (locale: string) => ({
    name: locale === "am" ? "አበበ" : "Abebe",
    amount: "100",
    day: dayName(0, locale),
    link: form.yebunaUrl || `${origin}/donations`,
    stop: `${origin}${locale === "am" ? "/am" : ""}/stop/AbC123xYz9`,
  });

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
              Create a page at ye-buna.com, then paste its link here. Donors go there to give; it is also the {"{link}"} in SMS messages.
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
          <label className="a-check">
            <input type="checkbox" checked={form.remindersEnabled} onChange={(e) => set("remindersEnabled", e.target.checked)} /> Send weekly SMS
            reminders automatically (every day at 9:00 Ethiopian time, to donors whose day it is)
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
            reached on Telegram, don’t also send the SMS (saves SMS costs)
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.telegramUserEnabled} onChange={(e) => set("telegramUserEnabled", e.target.checked)} /> For
            donors who haven’t connected the bot, try the ministry’s Telegram account (by @username or phone) before SMS
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.welcomeEnabled} onChange={(e) => set("welcomeEnabled", e.target.checked)} /> Send a welcome SMS when
            someone registers
          </label>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>SMS messages</h2>
            <p>
              Placeholders: {"{name}"} first name · {"{amount}"} weekly birr · {"{day}"} reminder day · {"{link}"} Ye-Buna link · {"{stop}"} personal
              stop link
            </p>
          </div>
          {TEMPLATES.map(({ key, label, locale }) => {
            const preview = fillTemplate(form[key], sample(locale));
            const info = smsSegments(preview);
            return (
              <div className="a-field" key={key}>
                <label htmlFor={`g-${key}`}>{label}</label>
                <textarea
                  id={`g-${key}`}
                  rows={3}
                  className={locale === "am" ? "am-text" : undefined}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
                <div className="sms-preview" dir="auto">
                  {preview}
                </div>
                <span className="a-hint">
                  Preview · {info.chars} characters · {info.segments} SMS per person{info.unicode ? " (Amharic uses 70 characters per SMS)" : ""}
                </span>
              </div>
            );
          })}
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
            <h2>AfroMessage</h2>
          </div>
          <ul className="q-log" style={{ marginTop: 0 }}>
            <li>
              <span>API token (AFROMESSAGE_TOKEN)</span>
              <span className={`pill ${sms.token ? "pill--ok" : "pill--new"}`}>{sms.token ? "Set" : "Missing"}</span>
            </li>
            <li>
              <span>Identifier ID (AFROMESSAGE_IDENTIFIER_ID)</span>
              <span className="pill">{sms.identifier ? "Set" : "Default"}</span>
            </li>
            <li>
              <span>Sender name (AFROMESSAGE_SENDER_NAME)</span>
              <span className="pill">{sms.sender || "Default"}</span>
            </li>
          </ul>
          {!sms.token ? (
            <p className="a-hint" style={{ marginTop: 10 }}>
              Add these in Vercel → Settings → Environment Variables (from your AfroMessage account), then redeploy.
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
            A one-time SMS with each donor’s personal link: one tap in Telegram connects them, and their reminders come there for free from then on.
            Each donor is only invited once.
          </p>
          <Notice msg={inviteMsg} />
          <div className="btn-group">
            <button
              type="button"
              className="a-btn a-btn--sm"
              disabled={pending || !telegram.bot || !sms.token || invites.withUsername === 0}
              onClick={() => invite("username", invites.withUsername)}
            >
              Invite {invites.withUsername} with a Telegram username
            </button>
            <button
              type="button"
              className="a-btn a-btn--ghost a-btn--sm"
              disabled={pending || !telegram.bot || !sms.token || invites.all === 0}
              onClick={() => invite("all", invites.all)}
            >
              Invite all {invites.all} not on Telegram yet
            </button>
          </div>
          {!telegram.bot ? <p className="a-hint" style={{ marginTop: 8 }}>Set up the bot first.</p> : null}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Ministry Telegram account</h2>
          </div>
          <p className="a-hint" style={{ marginBottom: 10 }}>
            Reaches donors who never pressed Start on the bot, by their @username or phone number. Use a dedicated ministry number:
            Telegram limits accounts that message many people, so at most 80 are sent per day, spaced out, and it switches to SMS if Telegram asks
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
            <h2>Send a test SMS</h2>
          </div>
          <Notice msg={testMsg} />
          <div className="a-field">
            <label htmlFor="t-phone">Mobile number</label>
            <input id="t-phone" type="tel" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="09…" />
          </div>
          <div className="a-field">
            <label htmlFor="t-msg">Message (optional)</label>
            <textarea id="t-msg" rows={2} dir="auto" value={test.message} onChange={(e) => setTest({ ...test, message: e.target.value })} />
          </div>
          <button
            type="button"
            className="a-btn"
            disabled={pending || !sms.token}
            onClick={() =>
              start(async () => {
                const res = await sendTestSms(test.phone, test.message);
                setTestMsg(res.ok ? { ok: true, text: "Sent. Check the phone." } : { ok: false, text: res.error ?? "Not sent." });
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
            disabled={pending || (!sms.token && !telegram.connected) || dueToday === 0}
            onClick={() =>
              confirm(`Send today’s reminder to ${dueToday} donor(s) now?`) &&
              start(async () => {
                const run = await runRemindersNow();
                setRunMsg(
                  run.disabled
                    ? { ok: false, text: "Automatic reminders are turned off above." }
                    : {
                        ok: run.failed === 0,
                        text: `Sent ${run.sent} SMS and ${run.telegram} Telegram, skipped ${run.skippedPaid} (already paid), failed ${run.failed}.`,
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
