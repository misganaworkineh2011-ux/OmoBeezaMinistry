"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { deliver, type DeliveryMode } from "@/lib/mailto";
import { useSite } from "@/components/SiteProvider";
import { Field, FormSuccess, focusFirstError, validate, type FieldErrors } from "@/components/FormKit";
import Icon from "@/components/Icon";

const AREAS = ["teaching", "healthcare", "administration", "outreach", "volunteer"] as const;

export default function CareersForm() {
  const t = useTranslations("careers.form");
  const tf = useTranslations("forms");
  const [errors, setErrors] = useState<FieldErrors>({});
  const site = useSite();
  const [sent, setSent] = useState<DeliveryMode | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const next = validate(
      data,
      { required: ["name", "email", "area", "message"], email: ["email"] },
      { required: tf("required"), invalidEmail: tf("invalidEmail") },
    );
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(form, next);
      return;
    }
    const area = String(data.get("area"));
    setBusy(true);
    const mode = await deliver(
      "careers",
      `General interest application — ${t(`areas.${area}`)}`,
      [
        { label: t("phone"), value: String(data.get("phone") ?? "") },
        { label: t("area"), value: t(`areas.${area}`) },
        { label: t("message"), value: String(data.get("message")) },
      ],
      { to: site.email, name: String(data.get("name")), email: String(data.get("email")) },
    );
    setBusy(false);
    setSent(mode);
  };

  if (sent) return <FormSuccess mode={sent} onReset={() => setSent(null)} />;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form__row">
        <Field id="cf-name" name="name" label={t("name")} autoComplete="name" error={errors.name} />
        <Field id="cf-email" name="email" type="email" label={t("email")} autoComplete="email" error={errors.email} />
      </div>
      <div className="form__row">
        <Field id="cf-phone" name="phone" type="tel" label={t("phone")} autoComplete="tel" optional />
        <Field id="cf-area" name="area" label={t("area")} error={errors.area}>
          <select
            id="cf-area"
            name="area"
            defaultValue=""
            aria-invalid={errors.area ? true : undefined}
            aria-describedby={errors.area ? "cf-area-error" : undefined}
          >
            <option value="" disabled>
              {t("areaPlaceholder")}
            </option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {t(`areas.${a}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="cf-message" name="message" label={t("message")} multiline rows={6} error={errors.message} />
      <div>
        <button type="submit" className="btn btn--lg" disabled={busy}>
          {t("submit")} <Icon name="send" />
        </button>
      </div>
    </form>
  );
}
