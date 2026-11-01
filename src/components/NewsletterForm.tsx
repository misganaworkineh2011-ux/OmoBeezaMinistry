"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { deliver, isEmail, type DeliveryMode } from "@/lib/mailto";
import { useSite } from "@/components/SiteProvider";
import Icon from "@/components/Icon";

export default function NewsletterForm() {
  const t = useTranslations("newsletter");
  const tf = useTranslations("forms");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const site = useSite();
  const [done, setDone] = useState<DeliveryMode | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(true);
      return;
    }
    setDone(await deliver("newsletter", "Subscribe to prayer & news updates", [], { to: site.email, email }));
  };

  if (done) {
    return (
      <p className="subscribe-done" role="status">
        <Icon name="check" /> {done === "saved" ? t("saved") : t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="subscribe">
        <label htmlFor="newsletter-email" className="sr-only">
          {t("placeholder")}
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder={t("placeholder")}
          value={email}
          aria-invalid={error || undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(false);
          }}
        />
        <button type="submit" className="btn btn--gold btn--sm">
          {t("submit")}
        </button>
      </div>
      {error ? (
        <p id="newsletter-error" className="field__error" style={{ marginTop: 8, color: "#f5b08a" }}>
          {tf("invalidEmail")}
        </p>
      ) : null}
    </form>
  );
}
