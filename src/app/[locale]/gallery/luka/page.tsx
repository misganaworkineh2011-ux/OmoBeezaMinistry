import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { getLukaChildren } from "@/lib/data/galleries";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import SectionHead from "@/components/SectionHead";
import PrayerWall from "@/components/PrayerWall";
import CtaBand from "@/components/CtaBand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery.luka" });
  const lukaChildren = await getLukaChildren();
  return buildMetadata({
    locale,
    title: t("title"),
    description: t("descr"),
    path: "/gallery/luka",
    image: lukaChildren[0]?.card.src,
  });
}

export default async function LukaGalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gallery");
  const tNav = await getTranslations("nav");
  const lukaChildren = await getLukaChildren();

  return (
    <>
      <PageHero
        title={t("luka.title")}
        lead={t("luka.descr")}
        image={lukaChildren[1]?.portrait.src ?? lukaChildren[0]?.portrait.src}
        current={t("luka.title")}
        trail={[{ label: tNav("gallery"), href: "/gallery" }]}
        next="var(--cream)"
      />

      <section className="section section--cream wall-section">
        <div className="container">
          <SectionHead
            eyebrow={t("luka.eyebrow")}
            title={t.rich("luka.wallTitle", richEm)}
            lead={t("luka.wallLead")}
            align="center"
          />
          <PrayerWall items={lukaChildren} />
          <p className="wall-note">
            <Icon name="info" /> {t("luka.note")}
          </p>
          <div className="btn-row justify-center mt-md">
            <Link href="/gallery" className="btn btn--outline">
              <Icon name="arrowLeft" /> {t("allAlbums")}
            </Link>
            <Link href="/get-involved#pray" className="btn">
              {tNav("involved")} <Icon name="arrowRight" />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
