"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { deliver, type DeliveryMode } from "@/lib/mailto";
import { useSite } from "@/components/SiteProvider";
import { Field, FormSuccess, focusFirstError, validate, type FieldErrors } from "@/components/FormKit";
import Icon from "@/components/Icon";

const TYPES = ["request", "encouragement", "commitment"] as const;

export default function PrayerForm() {
  const t = useTranslations("forms.prayer");
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
      { required: ["name", "message"], email: ["email"] },
      { required: tf("required"), invalidEmail: tf("invalidEmail") },
    );
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(form, next);
      return;
    }
    const type = String(data.get("type") || "request");
    setBusy(true);
    const mode = await deliver(
      "prayer",
      `Prayer — ${t(`types.${type}`)}`,
      [
        { label: t("type"), value: t(`types.${type}`) },
        { label: t("message"), value: String(data.get("message")) },
      ],
      { to: site.email, name: String(data.get("name")), email: String(data.get("email") ?? "") },
    );
    setBusy(false);
    setSent(mode);
  };

  if (sent) return <FormSuccess mode={sent} onReset={() => setSent(null)} />;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form__row">
        <Field id="p-name" name="name" label={t("name")} autoComplete="name" error={errors.name} />
        <Field
          id="p-email"
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          optional
          error={errors.email}
        />
      </div>
      <Field id="p-type" name="type" label={t("type")}>
        <select id="p-type" name="type" defaultValue="request">
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-message" name="message" label={t("message")} multiline rows={5} error={errors.message} />
      <div>
        <button type="submit" className="btn btn--lg" disabled={busy}>
          {t("submit")} <Icon name="send" />
        </button>
      </div>
    </form>
  );
}
