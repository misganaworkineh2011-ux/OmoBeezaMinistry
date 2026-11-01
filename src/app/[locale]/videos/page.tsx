import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { getVideoSets } from "@/lib/data/videos";
import type { IconName } from "@/components/Icon";
import PageHero from "@/components/PageHero";
import SectionHead from "@/components/SectionHead";
import Reveal from "@/components/Reveal";
import FeatureFilm from "@/components/FeatureFilm";
import ReelRail from "@/components/ReelRail";
import LogoStory from "@/components/LogoStory";
import { Wave } from "@/components/Decor";
import CtaBand from "@/components/CtaBand";

interface LogoPoint {
  icon: IconName;
  title: string;
  descr: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "videos", "/videos");
}

export default async function VideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("videos");
  const tNav = await getTranslations("nav");

  const { all: videos, featureFilm, logoFilm, reels } = await getVideoSets(locale);
  const heroPoster = reels[0]?.poster ?? featureFilm?.poster;

  return (
    <>
      <PageHero
        title={t("hero.title")}
        lead={t("hero.lead")}
        image={heroPoster}
        current={tNav("videos")}
        trail={[{ label: tNav("gallery"), href: "/gallery" }]}
        next="var(--navy-900)"
      />

      {featureFilm ? (
        <section className="section section--navy film-section">
          <div className="container">
            <SectionHead
              eyebrow={t("film.eyebrow")}
              title={t.rich("film.title", richEm)}
              lead={t("film.lead")}
              align="center"
              light
            />
            <Reveal animation="zoom">
              <FeatureFilm
                video={featureFilm}
                title={featureFilm.title ?? ""}
                tag={featureFilm.tag ?? ""}
                playLabel={t("film.play")}
                seal={t("film.seal")}
                closeLabel={t("close")}
              />
            </Reveal>
          </div>
        </section>
      ) : null}

      {reels.length > 0 ? (
        <>
          <Wave from="var(--navy-900)" to="var(--cream)" flip />
          <section className="section section--cream">
            <div className="container">
              <SectionHead eyebrow={t("reels.eyebrow")} title={t.rich("reels.title", richEm)} lead={t("reels.lead")} />
              <ReelRail
                reels={reels}
                watch={t("reels.watch")}
                prev={t("reels.prev")}
                next={t("reels.next")}
                closeLabel={t("close")}
              />
            </div>
          </section>
          <Wave from="var(--cream)" to="var(--white)" />
        </>
      ) : null}

      {logoFilm ? (
        <section className="section">
          <div className="container">
            <SectionHead eyebrow={t("logo.eyebrow")} title={t.rich("logo.title", richEm)} lead={t("logo.lead")} align="center" />
            <LogoStory video={logoFilm} points={t.raw("logo.points") as LogoPoint[]} replay={t("logo.replay")} />
          </div>
        </section>
      ) : null}

      {videos.length === 0 ? <section className="section" /> : null}

      <CtaBand />
    </>
  );
}
