"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTemplates } from "@/app/admin/actions/donors";
import Icon from "@/components/Icon";
import { dayName, fillTemplate, smsSegments, type TemplateKey } from "@/lib/giving";

type Templates = Record<TemplateKey, string>;

interface Item {
  label: string;
  locale: "en" | "am";
  body: TemplateKey;
  subject?: TemplateKey;
}

const GROUPS: { title: string; hint: string; email: boolean; items: Item[] }[] = [
  {
    title: "Emails",
    hint: "Sent automatically by the website to donors who registered with an email address. A “Give” button is added below the text.",
    email: true,
    items: [
      { label: "Weekly reminder · English", locale: "en", subject: "emailReminderSubjectEn", body: "emailReminderEn" },
      { label: "Weekly reminder · Amharic", locale: "am", subject: "emailReminderSubjectAm", body: "emailReminderAm" },
      { label: "Welcome · English", locale: "en", subject: "emailWelcomeSubjectEn", body: "emailWelcomeEn" },
      { label: "Welcome · Amharic", locale: "am", subject: "emailWelcomeSubjectAm", body: "emailWelcomeAm" },
    ],
  },
  {
    title: "SMS and Telegram",
    hint: "SMS are sent from the ministry phone with the Android app (“Send SMS reminders”, and the welcome SMS after registering a donor). Telegram reminders use the same text; there {stop} becomes the bot’s /stop command.",
    email: false,
    items: [
      { label: "Weekly reminder · English", locale: "en", body: "reminderEn" },
      { label: "Weekly reminder · Amharic", locale: "am", body: "reminderAm" },
      { label: "Welcome · English", locale: "en", body: "welcomeEn" },
      { label: "Welcome · Amharic", locale: "am", body: "welcomeAm" },
    ],
  },
];

export default function MessageTemplatesForm({
  initial,
  defaults,
  yebunaUrl,
  origin,
}: {
  initial: Templates;
  defaults: Templates;
  yebunaUrl: string;
  origin: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = (Object.keys(form) as TemplateKey[]).some((k) => form[k] !== initial[k]);

  const set = (key: TemplateKey, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const sample = (locale: string) => ({
    name: locale === "am" ? "አቤ" : "Abebe",
    fullname: locale === "am" ? "አበበ ከበደ" : "Abebe Kebede",
    amount: "100",
    day: dayName(0, locale),
    link: yebunaUrl || `${origin}${locale === "am" ? "/am" : ""}/donations`,
    stop: `${origin}${locale === "am" ? "/am" : ""}/stop/AbC123xYz9`,
  });

  const save = () =>
    start(async () => {
      const res = await saveTemplates(form);
      setMsg(res.ok ? { ok: true, text: "Saved. New messages use these texts." } : { ok: false, text: res.error ?? "Not saved." });
      if (res.ok) router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Placeholders</h2>
        </div>
        {msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null}
        <ul className="q-log" style={{ marginTop: 0 }}>
          <li>
            <code>{"{name}"}</code>
            <span>The donor’s nickname, or their first name when they have none</span>
          </li>
          <li>
            <code>{"{fullname}"}</code>
            <span>The donor’s full name</span>
          </li>
          <li>
            <code>{"{amount}"}</code>
            <span>Their weekly amount in birr</span>
          </li>
          <li>
            <code>{"{day}"}</code>
            <span>Their reminder day</span>
          </li>
          <li>
            <code>{"{link}"}</code>
            <span>The Ye-Buna giving link</span>
          </li>
          <li>
            <code>{"{stop}"}</code>
            <span>Their personal link to stop reminders (required in reminders)</span>
          </li>
        </ul>
      </section>

      {GROUPS.map((group) => (
        <section className="panel" key={group.title}>
          <div className="panel__head">
            <h2>{group.title}</h2>
            <p>{group.hint}</p>
          </div>
          {group.items.map((item) => {
            const values = sample(item.locale);
            const body = fillTemplate(form[item.body], values, group.email);
            const info = smsSegments(body);
            const isDefault = form[item.body] === defaults[item.body] && (!item.subject || form[item.subject] === defaults[item.subject]);
            return (
              <div className="a-field" key={item.body} style={{ marginBottom: 26 }}>
                <label htmlFor={`m-${item.body}`}>
                  {item.label}{" "}
                  {!isDefault ? (
                    <button
                      type="button"
                      className="a-btn a-btn--ghost a-btn--sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        set(item.body, defaults[item.body]);
                        if (item.subject) set(item.subject, defaults[item.subject]);
                      }}
                    >
                      Use the default text
                    </button>
                  ) : null}
                </label>
                {item.subject ? (
                  <input
                    aria-label={`${item.label}: subject`}
                    className={item.locale === "am" ? "am-text" : undefined}
                    value={form[item.subject]}
                    onChange={(e) => set(item.subject as TemplateKey, e.target.value)}
                    placeholder="Subject"
                    style={{ marginBottom: 8 }}
                  />
                ) : null}
                <textarea
                  id={`m-${item.body}`}
                  rows={group.email ? 9 : 3}
                  className={item.locale === "am" ? "am-text" : undefined}
                  value={form[item.body]}
                  onChange={(e) => set(item.body, e.target.value)}
                />
                <div className="sms-preview" dir="auto">
                  {item.subject ? <strong style={{ display: "block", marginBottom: 6 }}>{fillTemplate(form[item.subject], values)}</strong> : null}
                  {body}
                </div>
                <span className="a-hint">
                  Preview
                  {group.email
                    ? ""
                    : ` · ${info.chars} characters · ${info.segments} SMS per person${info.unicode ? " (Amharic uses 70 characters per SMS)" : ""}`}
                </span>
              </div>
            );
          })}
        </section>
      ))}

      <div className="form-actions">
        <button type="button" className="a-btn a-btn--gold" disabled={pending || !changed} onClick={save}>
          <Icon name="check" /> {pending ? "Saving…" : "Save templates"}
        </button>
      </div>
    </>
  );
}
