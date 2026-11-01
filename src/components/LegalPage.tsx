import { getTranslations } from "next-intl/server";
import PageHero from "@/components/PageHero";

interface Section {
  title: string;
  body: string[];
}

/** Shared renderer for the Privacy Policy and Terms of Use pages. */
export default async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as Section[];
  const title = t(`${doc}.title`);

  return (
    <>
      <PageHero title={title} current={title} />
      <section className="section">
        <div className="container container--narrow legal">
          <span className="legal__updated">
            {t("updatedLabel")}: {t("updated")}
          </span>
          <p className="lead mt-md">{t(`${doc}.intro`)}</p>
          {sections.map((s) => (
            <div key={s.title}>
              <h2>{s.title}</h2>
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
