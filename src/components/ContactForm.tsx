"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { deliver, type DeliveryMode } from "@/lib/mailto";
import { useSite } from "@/components/SiteProvider";
import { Field, FormSuccess, focusFirstError, validate, type FieldErrors } from "@/components/FormKit";
import Icon from "@/components/Icon";

const SUBJECTS = ["general", "giving", "partner", "visit", "media"] as const;

export default function ContactForm() {
  const t = useTranslations("contact.form");
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
      { required: ["name", "email", "message"], email: ["email"] },
      { required: tf("required"), invalidEmail: tf("invalidEmail") },
    );
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(form, next);
      return;
    }
    const topic = String(data.get("subject") || "general");
    setBusy(true);
    const mode = await deliver(
      "contact",
      `Website enquiry — ${t(`subjects.${topic}`)}`,
      [
        { label: t("subject"), value: t(`subjects.${topic}`) },
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
        <Field id="c-name" name="name" label={t("name")} autoComplete="name" error={errors.name} />
        <Field id="c-email" name="email" type="email" label={t("email")} autoComplete="email" error={errors.email} />
      </div>
      <Field id="c-subject" name="subject" label={t("subject")}>
        <select id="c-subject" name="subject" defaultValue="general">
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {t(`subjects.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="c-message" name="message" label={t("message")} multiline rows={6} error={errors.message} />
      <div>
        <button type="submit" className="btn btn--lg" disabled={busy}>
          {t("submit")} <Icon name="send" />
        </button>
      </div>
    </form>
  );
}
