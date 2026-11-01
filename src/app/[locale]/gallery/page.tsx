import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import type { Photo } from "@/lib/galleries";
import { getAlbums, getLukaChildren } from "@/lib/data/galleries";
import { getVideos } from "@/lib/data/videos";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import AlbumCard from "@/components/AlbumCard";
import PhotoStrip from "@/components/PhotoStrip";
import CtaBand from "@/components/CtaBand";

interface StoryPhoto {
  image: string;
  w: number;
  h: number;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "gallery", "/gallery");
}

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gallery");
  const tNav = await getTranslations("nav");
  const tVid = await getTranslations("videos");

  const [lukaChildren, albums, videos] = await Promise.all([getLukaChildren(), getAlbums(locale), getVideos(locale)]);
  const reels = videos.filter((v) => v.kind === "reel");
  const videoCovers: Photo[] = (reels.length ? reels : videos).slice(0, 3).map((v) => ({ src: v.poster, w: v.w, h: v.h }));
  const stories: Photo[] = ((await getTranslations("stories")).raw("gallery") as StoryPhoto[]).map((s) => ({
    src: s.image,
    w: s.w,
    h: s.h,
  }));
  const lukaCovers = lukaChildren.slice(0, 3).map((c) => c.portrait);

  // Interleave every album into the decorative ribbon.
  const strip: Photo[] = [];
  const pools = [lukaChildren.map((c) => c.portrait), ...albums.map((a) => a.photos), stories];
  for (let i = 0; strip.length < 18 && i < 40; i++) {
    for (const pool of pools) if (pool[i] && strip.length < 18) strip.push(pool[i]);
  }

  return (
    <>
      <PageHero
        title={t("hero.title")}
        lead={t("hero.lead")}
        image={lukaChildren[0]?.portrait.src ?? "/img/photos/smile.jpg"}
        current={tNav("gallery")}
      />

      <section className="section">
        <div className="container">
          <SectionHead eyebrow={t("albumsEyebrow")} title={t.rich("albumsTitle", richEm)} align="center" />
          <div className="albums">
            {lukaChildren.length > 0 ? (
              <Reveal className="albums__featured">
                <AlbumCard
                  featured
                  href="/gallery/luka"
                  icon="handHeart"
                  tag={t("luka.tag")}
                  title={t("luka.title")}
                  descr={t("luka.descr")}
                  meta={t("children", { count: lukaChildren.length })}
                  cta={t("open")}
                  covers={lukaCovers}
                />
              </Reveal>
            ) : null}
            {albums.map((album, i) => (
              <Reveal key={album.id} delay={((i % 3) + 1) * 80}>
                <AlbumCard
                  href={`/gallery/${album.id}`}
                  icon={album.icon}
                  tag={album.tag}
                  title={album.title}
                  descr={album.descr}
                  meta={t("photos", { count: album.photos.length })}
                  cta={t("open")}
                  covers={album.photos}
                />
              </Reveal>
            ))}
            <Reveal delay={((albums.length % 3) + 1) * 80}>
              <AlbumCard
                href="/stories"
                icon="smile"
                tag={t("stories.tag")}
                title={t("stories.title")}
                descr={t("stories.descr")}
                meta={t("photos", { count: stories.length })}
                cta={t("open")}
                covers={stories}
              />
            </Reveal>
            {videos.length > 0 ? (
              <Reveal className="albums__featured">
                <AlbumCard
                  featured
                  href="/videos"
                  icon="film"
                  tag={tVid("card.tag")}
                  title={tVid("card.title")}
                  descr={tVid("card.descr")}
                  meta={tVid("card.meta", { count: videos.length })}
                  cta={tVid("film.more")}
                  covers={videoCovers}
                />
              </Reveal>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section section--tight section--sand strip-section">
        <p className="strip-section__label">
          <span className="script-note">{t("strip")}</span>
        </p>
        <PhotoStrip photos={strip} />
      </section>

      <CtaBand />
    </>
  );
}
