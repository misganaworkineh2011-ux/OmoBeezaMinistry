import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import CareersForm from "@/components/CareersForm";
import CtaBand from "@/components/CtaBand";

interface Benefit {
  title: string;
  descr: string;
  icon: IconName;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "careers", "/careers");
}

export default async function CareersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("careers");
  const tNav = await getTranslations("nav");
  const benefits = t.raw("why") as Benefit[];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/classroom.jpg" current={tNav("careers")} />

      <section className="section">
        <div className="container">
          <SectionHead eyebrow={t("whyEyebrow")} title={t.rich("whyTitle", richEm)} align="center" />
          <div className="grid grid-3">
            {benefits.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 80}>
                <div className="card card--hover">
                  <span className="icon-badge">
                    <Icon name={b.icon} />
                  </span>
                  <h3>{b.title}</h3>
                  <p>{b.descr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="container split split--start">
          <Reveal>
            <span className="eyebrow">{t("openTitle")}</span>
            <div className="empty-state mt-sm">
              <span className="icon-badge">
                <Icon name="briefcase" />
              </span>
              <h3>{t("openEmptyTitle")}</h3>
              <p>{t("openEmpty")}</p>
            </div>
          </Reveal>
          <Reveal className="form-card" animation="left">
            <h2>{t("formTitle")}</h2>
            <p>{t("formText")}</p>
            <CareersForm />
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
