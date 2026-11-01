import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/metadata";
import { routing } from "@/i18n/routing";
import { getAlbum, getAlbums, getLukaChildren } from "@/lib/data/galleries";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import PhotoAlbum from "@/components/PhotoAlbum";
import AlbumCard from "@/components/AlbumCard";
import CtaBand from "@/components/CtaBand";

export async function generateStaticParams() {
  const albums = await getAlbums(routing.defaultLocale);
  return albums.map((a) => ({ album: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; album: string }>;
}): Promise<Metadata> {
  const { locale, album: id } = await params;
  const album = await getAlbum(locale, id);
  if (!album) return {};
  return buildMetadata({
    locale,
    title: album.title,
    description: album.descr,
    path: `/gallery/${album.id}`,
    image: album.photos[0]?.src,
  });
}

export default async function AlbumPage({ params }: { params: Promise<{ locale: string; album: string }> }) {
  const { locale, album: id } = await params;
  setRequestLocale(locale);
  const album = await getAlbum(locale, id);
  if (!album) notFound();

  const t = await getTranslations("gallery");
  const tNav = await getTranslations("nav");
  const [lukaChildren, albums] = await Promise.all([getLukaChildren(), getAlbums(locale)]);
  const { photos, title } = album;
  // The header frame is a tall arch, so prefer a portrait-orientation photo.
  const heroPhoto = photos.find((p) => p.h > p.w) ?? photos[0];
  const others = albums.filter((a) => a.id !== album.id);

  return (
    <>
      <PageHero
        title={title}
        lead={album.descr}
        image={heroPhoto?.src}
        current={title}
        trail={[{ label: tNav("gallery"), href: "/gallery" }]}
      >
        <div className="page-hero__meta">
          {album.tag ? (
            <span>
              <Icon name={album.icon} /> {album.tag}
            </span>
          ) : null}
          <span>
            <Icon name="expand" /> {t("photos", { count: photos.length })}
          </span>
        </div>
      </PageHero>

      <section className="section">
        <div className="container">
          {photos.length > 0 ? (
            <PhotoAlbum photos={photos} title={title} />
          ) : (
            <Reveal className="soon">
              <div className="soon__stack" aria-hidden="true">
                <span />
                <span />
                <span>
                  <Icon name={album.icon} />
                </span>
              </div>
              <h2 className="title-md">{t("soonTitle")}</h2>
              <p>{t("soonText")}</p>
              <Link href="/gallery" className="btn btn--outline">
                <Icon name="arrowLeft" /> {t("allAlbums")}
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      <section className="section section--cream">
        <div className="container">
          <h2 className="title-md" style={{ marginBottom: 32 }}>
            {t("otherAlbums")}
          </h2>
          <div className="albums albums--two">
            {lukaChildren.length > 0 ? (
              <Reveal>
                <AlbumCard
                  href="/gallery/luka"
                  icon="handHeart"
                  tag={t("luka.tag")}
                  title={t("luka.title")}
                  descr={t("luka.descr")}
                  meta={t("children", { count: lukaChildren.length })}
                  cta={t("open")}
                  covers={lukaChildren.slice(0, 3).map((c) => c.portrait)}
                />
              </Reveal>
            ) : null}
            {others.map((a, i) => (
              <Reveal key={a.id} delay={(i + 1) * 80}>
                <AlbumCard
                  href={`/gallery/${a.id}`}
                  icon={a.icon}
                  tag={a.tag}
                  title={a.title}
                  descr={a.descr}
                  meta={t("photos", { count: a.photos.length })}
                  cta={t("open")}
                  covers={a.photos}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
