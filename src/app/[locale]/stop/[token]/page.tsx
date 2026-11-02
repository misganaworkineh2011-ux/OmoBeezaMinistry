import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { queryOne, safeRead } from "@/lib/db";
import Icon from "@/components/Icon";
import { stopReminders } from "./actions";

// Personal link at the end of every reminder SMS: lets a donor stop their
// weekly reminders. Stopping needs a button press (not just opening the link),
// so link previews in messaging apps can't stop reminders by accident.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("giving.stop");
  const done = (await searchParams).done === "1";

  const donor = /^[A-Za-z0-9_-]{8,40}$/.test(token)
    ? await safeRead(
        () => queryOne<{ name: string; amount: number; status: string }>("select name, amount, status from donors where token = $1", [token]),
        null,
      )
    : null;

  let body: React.ReactNode;
  if (!donor) body = <p>{t("invalid")}</p>;
  else if (done) body = <p>{t("done")}</p>;
  else if (donor.status === "stopped") body = <p>{t("already")}</p>;
  else {
    body = (
      <>
        <p>{t("lead", { name: donor.name.split(/\s+/)[0] ?? donor.name, amount: donor.amount.toLocaleString("en-US") })}</p>
        <form action={stopReminders.bind(null, locale, token)}>
          <button type="submit" className="btn btn--lg">
            {t("button")}
          </button>
        </form>
      </>
    );
  }

  return (
    <section className="section">
      <div className="container stop-card">
        <span className="icon-badge icon-badge--gold" style={{ margin: "0 auto 14px" }}>
          <Icon name="handHeart" />
        </span>
        <h1 className="title-md">{t("title")}</h1>
        {body}
        <Link href="/" className="text-link">
          <Icon name="arrowLeft" /> {t("back")}
        </Link>
      </div>
    </section>
  );
}
