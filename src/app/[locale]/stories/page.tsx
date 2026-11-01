import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { listPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import Gallery, { type GalleryItem } from "@/components/Gallery";
import PostCard from "@/components/PostCard";
import CtaBand from "@/components/CtaBand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "stories", "/stories");
}

export default async function StoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("stories");
  const tHome = await getTranslations("home");
  const tNav = await getTranslations("nav");

  const gallery = t.raw("gallery") as GalleryItem[];
  const posts = isLocale(locale) ? (await listPosts(locale)).slice(0, 3) : [];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/smile.jpg" current={tNav("stories")} />

      <section className="section">
        <div className="container">
          <Gallery items={gallery} />
        </div>
      </section>

      <section className="section section--blue">
        <div className="container">
          <Reveal className="testimonial" animation="zoom">
            <div className="testimonial__media">
              <Image src="/img/photos/smile.jpg" alt="" fill sizes="(max-width: 860px) 100vw, 480px" />
            </div>
            <div className="testimonial__body">
              <span className="eyebrow">{tHome("testimonial.eyebrow")}</span>
              <blockquote>“{tHome("testimonial.quote")}”</blockquote>
              <cite>— {tHome("testimonial.author")}</cite>
            </div>
          </Reveal>
        </div>
      </section>

      {posts.length > 0 ? (
        <section className="section">
          <div className="container">
            <SectionHead eyebrow={t("storiesEyebrow")} title={t.rich("storiesTitle", richEm)} align="center" />
            <div className="grid grid-3">
              {posts.map((post, i) => (
                <Reveal key={post.slug} delay={i * 100}>
                  <PostCard post={post} locale={locale} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CtaBand />
    </>
  );
}
