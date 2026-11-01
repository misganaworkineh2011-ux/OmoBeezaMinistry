import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { formatDate, listPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import PostCard from "@/components/PostCard";
import CtaBand from "@/components/CtaBand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "blog", "/blog");
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const posts = isLocale(locale) ? await listPosts(locale) : [];
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} current={tNav("blog")} />

      <section className="section">
        <div className="container">
          {!featured ? (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="book" />
              </span>
              <p>{t("empty")}</p>
            </div>
          ) : (
            <>
              <Reveal>
                <article className="post-feature">
                  <Link href={`/blog/${featured.slug}`} className="post-feature__media" tabIndex={-1} aria-hidden="true">
                    <Image src={featured.cover} alt="" fill priority sizes="(max-width: 860px) 100vw, 640px" />
                  </Link>
                  <div className="post-feature__body">
                    <span className="post-feature__tag">{t("featured")}</span>
                    <div className="post-meta">
                      <span>
                        <Icon name="calendar" /> {formatDate(featured.date, locale)}
                      </span>
                      <span>
                        <Icon name="clock" /> {tc("minRead", { minutes: featured.readingMinutes })}
                      </span>
                    </div>
                    <h2>
                      <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
                    </h2>
                    <p>{featured.excerpt}</p>
                    <Link href={`/blog/${featured.slug}`} className="btn">
                      {t("readStory")} <Icon name="arrowRight" />
                    </Link>
                  </div>
                </article>
              </Reveal>

              {rest.length > 0 ? (
                <>
                  <h2 className="title-md mt-lg" style={{ marginBottom: 28 }}>
                    {t("more")}
                  </h2>
                  <div className="grid grid-3">
                    {rest.map((post, i) => (
                      <Reveal key={post.slug} delay={(i % 3) * 100}>
                        <PostCard post={post} locale={locale} />
                      </Reveal>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
