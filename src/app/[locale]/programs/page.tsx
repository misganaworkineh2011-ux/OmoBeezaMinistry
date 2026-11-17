import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import CtaBand from "@/components/CtaBand";

interface ProgramDetail {
  id: string;
  title: string;
  descr: string;
  points: string[];
  icon: IconName;
  image: string;
}
interface Pillar {
  title: string;
  descr: string;
  icon: IconName;
}
interface Place extends Pillar {
  stat: string;
  statLabel: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "programs", "/programs");
}

export default async function ProgramsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("programs");
  const tNav = await getTranslations("nav");
  const tc = await getTranslations("common");

  const items = t.raw("items") as ProgramDetail[];
  const pillars = t.raw("pillars.items") as Pillar[];
  const places = t.raw("places.items") as Place[];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/classroom.jpg" current={tNav("programs")}>
        <div className="btn-row mt-md">
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="btn btn--ghost-light btn--sm">
              <Icon name={item.icon} /> {item.title}
            </a>
          ))}
        </div>
      </PageHero>

      {/* PROGRAM ROWS */}
      <section className="section">
        <div className="container">
          {items.map((item, i) => (
            <div
              key={item.id}
              id={item.id}
              className={`split program-row${i % 2 === 1 ? " program-row--reverse" : ""}`}
            >
              <Reveal className="program-row__media" animation={i % 2 === 1 ? "left" : "right"}>
                <span className="program-row__index" aria-hidden="true">
                  0{i + 1}
                </span>
                <div className="media-frame">
                  <Image src={item.image} alt={item.title} fill sizes="(max-width: 960px) 90vw, 600px" />
                </div>
              </Reveal>
              <Reveal className="program-row__body" animation={i % 2 === 1 ? "right" : "left"}>
                <span className="icon-badge">
                  <Icon name={item.icon} />
                </span>
                <h2 className="title-lg">{item.title}</h2>
                <p className="lead">{item.descr}</p>
                <ul className="check-list">
                  {item.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="btn-row">
                  <Link href="/donations" className="btn">
                    {t("helpCta")} <Icon name="arrowRight" />
                  </Link>
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* PILLARS */}
      <section className="section section--cream">
        <div className="container">
          <SectionHead
            eyebrow={t("pillars.eyebrow")}
            title={t.rich("pillars.title", richEm)}
            lead={t("pillars.lead")}
            align="center"
          />
          <div className="grid grid-4">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="pillar">
                  <span className="icon-badge">
                    <Icon name={p.icon} />
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.descr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PLACES */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow={t("places.eyebrow")} title={t.rich("places.title", richEm)} align="center" />
          <div className="grid grid-2">
            {places.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <article className="need-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <span className="icon-badge">
                      <Icon name={p.icon} />
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span className="stat__value">{p.stat}</span>
                      <span className="stat__label" style={{ marginTop: 4 }}>
                        {p.statLabel}
                      </span>
                    </div>
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.descr}</p>
                  <Link href="/get-involved#give" className="text-link mt-sm">
                    {tc("learnMore")} <Icon name="arrowRight" />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
