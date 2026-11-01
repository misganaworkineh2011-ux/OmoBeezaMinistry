import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CtaBand from "@/components/CtaBand";
import { Accordion, AccordionItem } from "@/components/Accordion";

interface FaqGroup {
  id: string;
  title: string;
  icon: IconName;
  items: { q: string; a: string }[];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "faq", "/faq");
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const tNav = await getTranslations("nav");
  const groups = t.raw("groups") as FaqGroup[];

  // FAQPage structured data helps search engines show answers directly.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} current={tNav("faq")} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="section">
        <div className="container faq-layout">
          <aside>
            <nav className="faq-nav" aria-label={tNav("faq")}>
              {groups.map((g) => (
                <a key={g.id} href={`#${g.id}`}>
                  <Icon name={g.icon} /> {g.title}
                </a>
              ))}
            </nav>
            <div className="faq-help">
              <h3>{t("help.title")}</h3>
              <p>{t("help.text")}</p>
              <Link href="/contact" className="btn btn--sm">
                {t("help.cta")} <Icon name="arrowRight" />
              </Link>
            </div>
          </aside>

          <div>
            {groups.map((g) => (
              <Reveal key={g.id} id={g.id} className="faq-group">
                <h2>{g.title}</h2>
                <Accordion defaultOpenId={g.id === groups[0]?.id ? `${g.id}-0` : null}>
                  {g.items.map((item, i) => (
                    <AccordionItem key={item.q} id={`${g.id}-${i}`} title={item.q}>
                      <p>{item.a}</p>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
