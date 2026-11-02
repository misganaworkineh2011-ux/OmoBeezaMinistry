"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Field, focusFirstError, type FieldErrors } from "@/components/FormKit";
import DonateForm from "@/components/DonateForm";
import Icon from "@/components/Icon";
import { useRouter } from "@/i18n/navigation";
import { dayName, normalizePhone } from "@/lib/giving";

type Tab = "weekly" | "once" | "abroad";

export interface GiveCardSettings {
  yebunaUrl: string;
  amounts: number[];
  minAmount: number;
  defaultDay: number;
}

/** The thank-you page, personalised through its address. */
function thankYouHref(params: Record<string, string | number>): string {
  return `/thank-you?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;
}

/**
 * Ye-Buna button: opens Ye-Buna in a new tab, and (with `thanks`) shows the
 * thank-you page in this one.
 */
function YebunaButton({ href, label, thanks }: { href: string; label: string; thanks?: string }) {
  const router = useRouter();
  return (
    <a
      className="btn btn--gold btn--lg btn--block btn--wrap"
      href={href}
      target="_blank"
      rel="noopener"
      onClick={() => {
        if (thanks) window.setTimeout(() => router.push(thanks), 300);
      }}
    >
      <Icon name="heart" /> {label} <Icon name="arrowRight" />
    </a>
  );
}

function WeeklyForm({ settings }: { settings: GiveCardSettings }) {
  const t = useTranslations("giving");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [amount, setAmount] = useState(String(settings.amounts[1] ?? settings.amounts[0] ?? 100));
  const [day, setDay] = useState(settings.defaultDay);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const router = useRouter();

  const numeric = Math.round(Number(amount)) || 0;
  const preset = settings.amounts.includes(numeric) && amount === String(numeric);
  const birr = (n: number) => t("birr", { amount: n.toLocaleString("en-US") });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "");
    const email = String(data.get("email") ?? "").trim();
    const next: FieldErrors = {};
    if (!name) next.name = tf("required");
    if (!normalizePhone(phone)) next.phone = t("invalidPhone");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = tf("invalidEmail");
    if (numeric < settings.minAmount) next.amount = t("minAmount", { min: settings.minAmount });
    if (!data.get("consent")) next.consent = t("consentRequired");
    setErrors(next);
    if (Object.keys(next).length) return focusFirstError(form, next);

    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/donors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, amount: numeric, day, locale, consent: true, website: data.get("website") }),
      });
      if (!res.ok) {
        setFailure(res.status === 429 ? t("rateLimited") : res.status === 503 ? t("unavailable") : t("error"));
      } else {
        // Registered: the thank-you page confirms it and offers the Ye-Buna button.
        router.push(thankYouHref({ kind: "weekly", name: name.split(/\s+/)[0] ?? name, amount: numeric, day }));
        return;
      }
    } catch {
      setFailure(t("error"));
    }
    setBusy(false);
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <p className="give-lead">{t("weeklyLead")}</p>

      <fieldset>
        <legend>{t("amountLegend")}</legend>
        <div className="amounts">
          {settings.amounts.map((a) => (
            <label key={a} className={`amount${preset && numeric === a ? " is-active" : ""}`}>
              <input
                type="radio"
                name="tier"
                value={a}
                checked={preset && numeric === a}
                onChange={() => {
                  setAmount(String(a));
                  setErrors((e) => ({ ...e, amount: undefined }));
                }}
              />
              {a.toLocaleString("en-US")}
            </label>
          ))}
          <div className="amount-other">
            <label htmlFor="give-other" className="sr-only">
              {t("customLabel")}
            </label>
            <input
              id="give-other"
              name="amount"
              className="input"
              type="number"
              min={settings.minAmount}
              step={1}
              inputMode="numeric"
              placeholder={t("customShort")}
              value={preset ? "" : amount}
              aria-invalid={errors.amount ? true : undefined}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              style={{ minHeight: 58, height: "100%" }}
            />
          </div>
        </div>
        {errors.amount ? (
          <p className="field__error" style={{ marginTop: 8 }}>
            {errors.amount}
          </p>
        ) : null}
      </fieldset>

      <div className="field">
        <label htmlFor="give-day">{t("dayLabel")}</label>
        <select id="give-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <option key={d} value={d}>
              {dayName(d, locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="form__row">
        <Field id="give-name" name="name" label={t("name")} autoComplete="name" error={errors.name} />
        <Field id="give-phone" name="phone" type="tel" label={t("phone")} autoComplete="tel" placeholder="09…" error={errors.phone} />
      </div>
      <Field id="give-email" name="email" type="email" label={t("email")} autoComplete="email" optional error={errors.email} />

      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp-field" />

      <label className="consent">
        <input type="checkbox" name="consent" aria-invalid={errors.consent ? true : undefined} />
        <span>{t("consent")}</span>
      </label>
      {errors.consent ? <p className="field__error">{errors.consent}</p> : null}
      {failure ? (
        <p className="field__error" role="alert">
          {failure}
        </p>
      ) : null}

      <button type="submit" className="btn btn--gold btn--lg btn--block btn--wrap" disabled={busy}>
        <Icon name="heart" /> {t("submit", { amount: numeric > 0 ? numeric.toLocaleString("en-US") : "…" })}
      </button>
      <p className="donate-card__note">
        <Icon name="info" />
        <span>
          {t("note")} {numeric > 0 ? `(${birr(numeric)})` : ""}
        </span>
      </p>
    </form>
  );
}

export default function GiveCard({ settings }: { settings: GiveCardSettings }) {
  const t = useTranslations("giving");
  const [tab, setTab] = useState<Tab>("weekly");

  return (
    <div>
      <div className="segmented give-tabs" role="tablist">
        {(["weekly", "once", "abroad"] as const).map((k) => (
          <label key={k} className={tab === k ? "is-active" : undefined}>
            <input type="radio" name="give-tab" value={k} checked={tab === k} onChange={() => setTab(k)} />
            {t(`tabs.${k}`)}
          </label>
        ))}
      </div>

      {tab === "weekly" ? <WeeklyForm settings={settings} /> : null}

      {tab === "once" ? (
        <div className="form">
          <h3 className="title-sm">{t("onceTitle")}</h3>
          <p className="give-lead">{t("onceLead")}</p>
          {settings.yebunaUrl ? (
            <YebunaButton href={settings.yebunaUrl} label={t("onceButton")} thanks={thankYouHref({ kind: "once" })} />
          ) : (
            <p>{t("comingSoon")}</p>
          )}
        </div>
      ) : null}

      {tab === "abroad" ? (
        <>
          <p className="give-lead">{t("abroadLead")}</p>
          <DonateForm />
        </>
      ) : null}
    </div>
  );
}
