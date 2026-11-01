"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSite } from "@/components/SiteProvider";
import { isEmail } from "@/lib/mailto";
import Icon from "@/components/Icon";

export type FieldErrors = Record<string, string | undefined>;

/** Required + email validation over FormData. Returns an error map (empty = valid). */
export function validate(
  data: FormData,
  rules: { required?: string[]; email?: string[] },
  messages: { required: string; invalidEmail: string },
): FieldErrors {
  const errors: FieldErrors = {};
  for (const name of rules.required ?? []) {
    if (String(data.get(name) ?? "").trim() === "") errors[name] = messages.required;
  }
  for (const name of rules.email ?? []) {
    const value = String(data.get(name) ?? "");
    if (!errors[name] && value && !isEmail(value)) errors[name] = messages.invalidEmail;
  }
  return errors;
}

export function focusFirstError(form: HTMLFormElement, errors: FieldErrors): void {
  const first = Object.keys(errors).find((k) => errors[k]);
  if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  optional?: boolean;
  children?: ReactNode;
  type?: string;
  autoComplete?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
}

/** Labelled input / textarea, or wraps a custom control passed as children. */
export function Field({
  id,
  name,
  label,
  error,
  optional,
  children,
  type = "text",
  autoComplete,
  multiline,
  rows = 5,
  placeholder,
  defaultValue,
}: FieldProps) {
  const t = useTranslations("common");
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    placeholder,
    defaultValue,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional ? <span className="opt">{t("optional")}</span> : null}
      </label>
      {children ??
        (multiline ? <textarea rows={rows} {...shared} /> : <input type={type} autoComplete={autoComplete} {...shared} />)}
      {error ? (
        <span id={errorId} className="field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function FormSuccess({
  title,
  text,
  onReset,
  resetLabel,
  mode = "mailto",
}: {
  title?: string;
  text?: string;
  /** "saved": delivered to the team; "mailto": handed to the email app. */
  mode?: "saved" | "mailto";
  onReset?: () => void;
  resetLabel?: string;
}) {
  const t = useTranslations("forms");
  const SITE = useSite();
  return (
    <div className="success" role="status">
      <span className="success__icon">
        <Icon name="check" />
      </span>
      <h3>{title ?? t("successTitle")}</h3>
      {mode === "saved" ? (
        <p>{text ?? t("sentText")}</p>
      ) : (
        <p>
          {text ?? t("successText")} <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>
      )}
      {onReset ? (
        <button type="button" className="btn btn--outline btn--sm" onClick={onReset}>
          {resetLabel ?? t("sendAnother")}
        </button>
      ) : null}
    </div>
  );
}
