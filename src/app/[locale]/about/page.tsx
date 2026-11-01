import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { telHref } from "@/lib/site";
import { getSite } from "@/lib/data/site";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import Scripture from "@/components/Scripture";
import CtaBand from "@/components/CtaBand";
import LogoStory from "@/components/LogoStory";
import { getVideoSets } from "@/lib/data/videos";

interface ValueItem {
  title: string;
  descr: string;
  icon: IconName;
}
interface LogoPoint {
  icon: IconName;
  title: string;
  descr: string;
}
interface Milestone extends ValueItem {
  when: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "about", "/about");
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const SITE = await getSite();
  const t = await getTranslations("about");
  const tNav = await getTranslations("nav");
  const tVid = await getTranslations("videos");
  const { logoFilm } = await getVideoSets(locale);

  const missionList = t.raw("mission.list") as string[];
  const visionList = t.raw("vision.list") as string[];
  const values = t.raw("values.items") as ValueItem[];
  const history = t.raw("history.items") as Milestone[];
  const region = t.raw("region.paragraphs") as string[];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/family.jpg" current={tNav("about")} />

      {/* STORY */}
      <section className="section">
        <div className="container split">
          <Reveal animation="right">
            <div className="collage">
              <div className="media-frame collage__main">
                <Image src="/img/photos/group.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 520px" />
              </div>
              <div className="media-frame collage__secondary">
                <Image src="/img/photos/classroom.jpg" alt="" fill sizes="(max-width: 960px) 45vw, 260px" />
              </div>
            </div>
          </Reveal>
          <Reveal animation="left">
            <span className="eyebrow">{t("story.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("story.title", richEm)}</h2>
            <p className="lead mt-sm">{t("story.descr")}</p>
            <div className="card mt-md" style={{ background: "var(--cream)", borderColor: "var(--line)" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span className="icon-badge icon-badge--gold icon-badge--sm">
                  <Icon name="sparkles" />
                </span>
                <h3 className="title-sm mt-0">{t("story.nameTitle")}</h3>
              </div>
              <p>{t("story.name")}</p>
            </div>
            <div className="btn-row mt-md">
              {SITE.phones.map((p) => (
                <a key={p} href={telHref(p)} className="btn btn--outline">
                  <Icon name="phone" /> {p}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* OUR MARK */}
      {logoFilm ? (
        <section className="section section--flush-top">
          <div className="container">
            <SectionHead eyebrow={tVid("logo.eyebrow")} title={tVid.rich("logo.title", richEm)} lead={tVid("logo.lead")} align="center" />
            <LogoStory video={logoFilm} points={tVid.raw("logo.points") as LogoPoint[]} replay={tVid("logo.replay")} />
          </div>
        </section>
      ) : null}

      {/* MISSION & VISION */}
      <section className="section section--cream">
        <div className="container">
          <SectionHead eyebrow={t("mvEyebrow")} title={t.rich("mvTitle", richEm)} align="center" />
          <div className="grid grid-2">
            <Reveal animation="right">
              <article className="mv-card mv-card--blue">
                <Icon name="target" className="mv-card__bg" />
                <span className="icon-badge">
                  <Icon name="target" />
                </span>
                <h3>{t("mission.title")}</h3>
                <p>{t("mission.descr")}</p>
                <ul className="check-list">
                  {missionList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
            <Reveal animation="left">
              <article className="mv-card mv-card--sand">
                <Icon name="eye" className="mv-card__bg" />
                <span className="icon-badge icon-badge--gold">
                  <Icon name="eye" />
                </span>
                <h3>{t("vision.title")}</h3>
                <p>{t("vision.descr")}</p>
                <ul className="check-list">
                  {visionList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow={t("values.eyebrow")} title={t.rich("values.title", richEm)} align="center" />
          <div className="grid grid-3">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 100}>
                <div className="card card--hover">
                  <span className="icon-badge">
                    <Icon name={v.icon} />
                  </span>
                  <h3>{v.title}</h3>
                  <p>{v.descr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HISTORY TIMELINE */}
      <section className="section section--navy">
        <div className="container split split--start">
          <div style={{ position: "sticky", top: "calc(var(--header-h) + 40px)" }}>
            <SectionHead eyebrow={t("history.eyebrow")} title={t.rich("history.title", richEm)} lead={t("history.lead")} light />
            <Reveal className="media-frame" animation="zoom">
              <div style={{ position: "relative", aspectRatio: "4 / 3" }}>
                <Image src="/img/photos/gathering.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 560px" />
              </div>
            </Reveal>
          </div>
          <ol className="timeline">
            {history.map((m, i) => (
              <Reveal as="li" key={m.title} className="timeline__item" delay={i * 80}>
                <span className="timeline__dot">
                  <Icon name={m.icon} />
                </span>
                <div className="timeline__card">
                  <span className="timeline__when">{m.when}</span>
                  <h3>{m.title}</h3>
                  <p>{m.descr}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* SOUTH OMO */}
      <section className="section section--sand">
        <div className="container split">
          <Reveal animation="right">
            <span className="eyebrow">{t("region.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("region.title", richEm)}</h2>
            <div className="stack mt-md lead">
              {region.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal animation="left">
            <div className="media-frame" style={{ aspectRatio: "4 / 5", boxShadow: "var(--shadow)" }}>
              <Image src="/img/photos/smile.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 520px" />
            </div>
          </Reveal>
        </div>
      </section>

      <Scripture image="/img/photos/group.jpg" />
      <CtaBand />
    </>
  );
}
