import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { formatDate, getAllSlugs, getPost, listPosts } from "@/lib/blog";
import { buildMetadata, localizedPath } from "@/lib/metadata";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import PostCard from "@/components/PostCard";
import ShareButtons from "@/components/ShareButtons";
import CtaBand from "@/components/CtaBand";

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getPost(locale, slug);
  if (!post) return {};
  return buildMetadata({
    locale,
    title: post.title,
    description: post.excerpt,
    path: `/blog/${slug}`,
    image: post.cover,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!isLocale(locale)) notFound();
  const post = await getPost(locale, slug);
  if (!post) notFound();

  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const related = (await listPosts(locale)).filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      <PageHero title={post.title} lead={post.excerpt} current={post.title} trail={[{ label: tNav("blog"), href: "/blog" }]}>
        <div className="page-hero__meta">
          <span>
            <Icon name="calendar" /> {formatDate(post.date, locale)}
          </span>
          <span>
            <Icon name="clock" /> {tc("minRead", { minutes: post.readingMinutes })}
          </span>
          <span>
            <Icon name="users" /> {t("by")} {post.author}
          </span>
        </div>
      </PageHero>

      <section className="section section--flush-top">
        <div className="container">
          <div className="media-frame article-cover">
            <Image src={post.cover} alt={post.title} fill priority sizes="(max-width: 1300px) 100vw, 1240px" />
          </div>
        </div>
        <div className="container container--narrow mt-lg">
          {post.isFallback ? (
            <p className="notice">
              <Icon name="info" />
              <span>{t("fallbackNotice")}</span>
            </p>
          ) : null}

          <article className="prose" lang={post.isFallback ? "en" : undefined}>
            <MDXRemote source={post.content} options={{ mdxOptions: { format: post.format } }} />
          </article>

          <div className="article-foot">
            <Link href="/blog" className="btn btn--outline">
              <Icon name="arrowLeft" /> {t("backToBlog")}
            </Link>
            <ShareButtons title={post.title} path={localizedPath(locale, `/blog/${slug}`)} />
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="section section--cream">
          <div className="container">
            <h2 className="title-md" style={{ marginBottom: 32 }}>
              {t("related")}
            </h2>
            <div className="grid grid-3">
              {related.map((p, i) => (
                <Reveal key={p.slug} delay={i * 100}>
                  <PostCard post={p} locale={locale} />
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
