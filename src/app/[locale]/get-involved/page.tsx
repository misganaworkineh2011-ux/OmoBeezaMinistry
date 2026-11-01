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
import PrayerForm from "@/components/PrayerForm";
import Socials from "@/components/Socials";
import CtaBand from "@/components/CtaBand";

interface Way {
  id: string;
  title: string;
  descr: string;
  icon: IconName;
  href: string;
  cta: string;
}
interface Need {
  id: string;
  title: string;
  icon: IconName;
  intro: string;
  list: string[];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "involved", "/get-involved");
}

export default async function GetInvolvedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("involved");
  const tRoot = await getTranslations();

  const ways = tRoot.raw("ways") as Way[];
  const needs = tRoot.raw("needs") as Need[];
  const prayer = tRoot.raw("prayer") as string[];
  const servePoints = t.raw("serve.points") as string[];
  const partnerPoints = t.raw("partner.points") as string[];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/drawings.jpg" current={tRoot("nav.involved")} next="var(--sand)" />

      {/* WAYS */}
      <section className="section section--sand">
        <div className="container">
          <div className="grid grid-4">
            {ways.map((w, i) => (
              <Reveal key={w.id} delay={i * 80}>
                <Link href={w.href} className="way-card">
                  <span className="icon-badge">
                    <Icon name={w.icon} />
                  </span>
                  <h3>{w.title}</h3>
                  <p>{w.descr}</p>
                  <span className="text-link">
                    {w.cta} <Icon name="arrowRight" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRAY */}
      <section id="pray" className="section section--navy">
        <div className="container split split--start">
          <div>
            <SectionHead eyebrow={t("pray.eyebrow")} title={t.rich("pray.title", richEm)} lead={t("pray.lead")} light />
            <Reveal as="ol" className="prayer-list">
              {prayer.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </Reveal>
            <Link href="/gallery/luka" className="btn btn--gold mt-md">
              <Icon name="handHeart" /> {tRoot("gallery.luka.homeCta")}
            </Link>
          </div>
          <Reveal className="form-card" animation="left">
            <h2>{t("pray.formTitle")}</h2>
            <p>{t("pray.formText")}</p>
            <PrayerForm />
          </Reveal>
        </div>
      </section>

      {/* GIVE */}
      <section id="give" className="section">
        <div className="container">
          <SectionHead
            eyebrow={t("give.eyebrow")}
            title={t.rich("give.title", richEm)}
            lead={t("give.lead")}
            aside={
              <Link href="/donations" className="btn btn--gold">
                <Icon name="heart" /> {tRoot("common.giveNow")}
              </Link>
            }
          />
          <div className="grid grid-2">
            {needs.map((n, i) => (
              <Reveal key={n.id} delay={i * 100}>
                <article className="need-panel">
                  <span className="icon-badge icon-badge--gold">
                    <Icon name={n.icon} />
                  </span>
                  <h3>{n.title}</h3>
                  <p>{n.intro}</p>
                  <ul className="check-list">
                    {n.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SERVE */}
      <section id="serve" className="section section--cream">
        <div className="container split">
          <Reveal animation="right">
            <div className="media-frame" style={{ aspectRatio: "5 / 4", boxShadow: "var(--shadow)" }}>
              <Image src="/img/photos/classroom.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 600px" />
            </div>
          </Reveal>
          <Reveal animation="left">
            <span className="eyebrow">{t("serve.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("serve.title", richEm)}</h2>
            <p className="lead mt-sm">{t("serve.lead")}</p>
            <ul className="check-list mt-md">
              {servePoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="btn-row mt-md">
              <Link href="/careers" className="btn">
                {t("serve.cta")} <Icon name="arrowRight" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PARTNER */}
      <section id="partner" className="section">
        <div className="container split">
          <Reveal animation="right">
            <span className="eyebrow">{t("partner.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("partner.title", richEm)}</h2>
            <p className="lead mt-sm">{t("partner.lead")}</p>
            <ul className="check-list mt-md">
              {partnerPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="btn-row mt-md">
              <Link href="/contact" className="btn">
                {t("partner.cta")} <Icon name="arrowRight" />
              </Link>
            </div>
          </Reveal>
          <Reveal animation="left">
            <div className="media-frame" style={{ aspectRatio: "5 / 4", boxShadow: "var(--shadow)" }}>
              <Image src="/img/photos/group.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 600px" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* SPREAD THE WORD */}
      <section className="section section--tight section--blue">
        <div className="container">
          <Reveal className="section-head section-head--center" >
            <span className="eyebrow eyebrow--center">{t("spread.eyebrow")}</span>
            <h2 className="title-md">{t("spread.title")}</h2>
            <p className="lead">{t("spread.lead")}</p>
            <div className="mt-md" style={{ display: "flex", justifyContent: "center" }}>
              <Socials variant="dark" />
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
