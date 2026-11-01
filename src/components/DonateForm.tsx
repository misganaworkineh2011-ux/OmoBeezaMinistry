"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { deliver, type DeliveryMode } from "@/lib/mailto";
import { useSite } from "@/components/SiteProvider";
import { TIERS } from "@/lib/donations";
import { Field, FormSuccess, focusFirstError, validate, type FieldErrors } from "@/components/FormKit";
import Icon from "@/components/Icon";

const DEFAULT_TIER = 50;

type Frequency = "once" | "monthly";

function isTier(n: number): n is (typeof TIERS)[number] {
  return (TIERS as readonly number[]).includes(n);
}

export default function DonateForm() {
  const t = useTranslations("donations");
  const tf = useTranslations("forms");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [amount, setAmount] = useState<string>(String(DEFAULT_TIER));
  const [errors, setErrors] = useState<FieldErrors>({});
  const site = useSite();
  const [sent, setSent] = useState<DeliveryMode | null>(null);
  const [busy, setBusy] = useState(false);

  const numeric = Math.round(Number(amount) * 100) / 100 || 0;
  const tierSelected = isTier(numeric) && amount === String(numeric);
  const display = `$${numeric.toLocaleString("en-US")}`;
  const freqLabel = frequency === "monthly" ? t("submitMonthly") : t("submitOnce");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const next = validate(
      data,
      { required: ["name", "email"], email: ["email"] },
      { required: tf("required"), invalidEmail: tf("invalidEmail") },
    );
    if (numeric < 1) next.amount = tf("invalidAmount");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(form, next);
      return;
    }
    setBusy(true);
    const mode = await deliver(
      "donation",
      `Donation pledge — ${display} ${frequency === "monthly" ? "monthly" : "one-time"}`,
      [
        { label: "Amount", value: `${display} USD` },
        { label: "Frequency", value: frequency === "monthly" ? "Monthly" : "One-time" },
        { label: t("dedication"), value: String(data.get("note") ?? "") },
        { label: "Request", value: "Please let me know how to complete my gift." },
      ],
      { to: site.email, name: String(data.get("name")), email: String(data.get("email")) },
    );
    setBusy(false);
    setSent(mode);
  };

  if (sent) {
    return (
      <FormSuccess
        title={t("successTitle")}
        mode={sent}
        text={t(sent === "saved" ? "successSaved" : "successText", { amount: display, frequency: t(`frequency.${frequency}`) })}
        onReset={() => setSent(null)}
        resetLabel={t("successAgain")}
      />
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <fieldset>
        <legend>{t("frequencyLegend")}</legend>
        <div className="segmented">
          {(["once", "monthly"] as const).map((f) => (
            <label key={f} className={frequency === f ? "is-active" : undefined}>
              <input
                type="radio"
                name="frequency"
                value={f}
                checked={frequency === f}
                onChange={() => setFrequency(f)}
              />
              {t(`frequency.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("amountLegend")}</legend>
        <div className="amounts">
          {TIERS.map((tier) => (
            <label key={tier} className={`amount${tierSelected && numeric === tier ? " is-active" : ""}`}>
              <input
                type="radio"
                name="tier"
                value={tier}
                checked={tierSelected && numeric === tier}
                onChange={() => {
                  setAmount(String(tier));
                  setErrors((e) => ({ ...e, amount: undefined }));
                }}
              />
              ${tier}
            </label>
          ))}
          <div className="amount-other">
            <label htmlFor="donate-other" className="sr-only">
              {t("customLabel")}
            </label>
            <span aria-hidden="true">$</span>
            <input
              id="donate-other"
              name="amount"
              className="input"
              type="number"
              min={1}
              step="any"
              inputMode="decimal"
              placeholder={t("customShort")}
              value={tierSelected ? "" : amount}
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

      <div className="impact-note" aria-live="polite">
        <span className="icon-badge icon-badge--gold icon-badge--sm">
          <Icon name="sparkles" />
        </span>
        <span>
          <strong>{display}</strong> — {isTier(numeric) ? t(`impact.${numeric}`) : t("impactCustom")}
        </span>
      </div>

      <div className="form__row">
        <Field id="d-name" name="name" label={t("name")} autoComplete="name" error={errors.name} />
        <Field id="d-email" name="email" type="email" label={t("email")} autoComplete="email" error={errors.email} />
      </div>
      <Field id="d-note" name="note" label={t("dedication")} optional multiline rows={2} />

      <button type="submit" className="btn btn--gold btn--lg btn--block" disabled={busy}>
        <Icon name="heart" /> {t("submit", { amount: display, frequency: freqLabel })}
      </button>

      <p className="donate-card__note">
        <Icon name="info" />
        <span>{t("note")}</span>
      </p>
    </form>
  );
}
