import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { listPosts } from "@/lib/blog";
import { getLukaChildren } from "@/lib/data/galleries";
import { getVideoSets } from "@/lib/data/videos";
import ReelRail from "@/components/ReelRail";
import FeatureFilm from "@/components/FeatureFilm";
import PrayerDeck from "@/components/PrayerDeck";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { telHref } from "@/lib/site";
import { getSite } from "@/lib/data/site";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import SectionHead from "@/components/SectionHead";
import Scripture from "@/components/Scripture";
import CtaBand from "@/components/CtaBand";
import PostCard from "@/components/PostCard";
import { Accordion, AccordionItem } from "@/components/Accordion";
import Parallax from "@/components/Parallax";
import { DoodleArrow, Marquee, SpinBadge, Wave } from "@/components/Decor";

interface Stat {
  value: number;
  suffix: string;
  label: string;
}
interface Titled {
  title: string;
  descr: string;
}
interface IconItem extends Titled {
  icon: IconName;
}
interface Program extends IconItem {
  id: string;
  image: string;
}
interface Way extends IconItem {
  id: string;
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
  return pageMetadata(locale, "home", "/");
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const SITE = await getSite();
  const lukaChildren = await getLukaChildren();
  const { featureFilm, reels } = await getVideoSets(locale);

  const t = await getTranslations("home");
  const tRoot = await getTranslations();
  const tProg = await getTranslations("programs");
  const tGal = await getTranslations("gallery");
  const tVid = await getTranslations("videos");

  const stats = t.raw("stats") as Stat[];
  const aboutList = t.raw("about.list") as string[];
  const challenges = t.raw("need.challenges") as IconItem[];
  const programs = tProg.raw("items") as Program[];
  const gratitude = t.raw("gratitude.items") as Titled[];
  const ways = tRoot.raw("ways") as Way[];
  const needs = tRoot.raw("needs") as Need[];
  const prayer = tRoot.raw("prayer") as string[];
  const posts = isLocale(locale) ? (await listPosts(locale)).slice(0, 3) : [];

  return (
    <>
      {/* HERO */}
      <section className="hero2">
        <div className="hero2__bg" aria-hidden="true">
          <span className="blob blob--1" />
          <span className="blob blob--2" />
          <span className="dots" />
        </div>
        <div className="container hero2__grid">
          <Reveal className="hero2__text">
            <span className="pill">
              <span className="pill__dot">
                <Icon name="heart" />
              </span>
              {t("hero.badge")}
            </span>
            <h1 className="title-xl">{t.rich("hero.title", richEm)}</h1>
            <p className="hero2__lead">{t("hero.lead")}</p>
            <div className="btn-row">
              <Link href="/donations" className="btn btn--lg">
                <Icon name="heart" /> {t("hero.donate")}
              </Link>
              <Link href="/about" className="btn btn--outline btn--lg">
                {t("hero.story")} <Icon name="arrowRight" />
              </Link>
            </div>
            <div className="hero2__trust">
              <span className="avatars" aria-hidden="true">
                {["/img/photos/smile.jpg", "/img/photos/drawings.jpg", "/img/photos/classroom.jpg"].map((src) => (
                  <span key={src}>
                    <Image src={src} alt="" fill sizes="48px" />
                  </span>
                ))}
              </span>
              <span>{t("hero.trust")}</span>
            </div>
          </Reveal>

          <Reveal className="hero2__visual" animation="zoom">
            <span className="hero2__sun" aria-hidden="true" />
            <span className="hero2__ring" aria-hidden="true" />
            <div className="hero2__arch">
              <Parallax speed={0.08} className="parallax--fill">
                <Image src="/img/photos/group.jpg" alt={t("hero.imageAlt")} fill priority sizes="(max-width: 960px) 80vw, 460px" />
              </Parallax>
            </div>
            <div className="hero2__circle">
              <Image src="/img/photos/smile.jpg" alt="" fill sizes="240px" />
            </div>
            <SpinBadge text={t("hero.seal")} className="hero2__spin" />
            <p className="hero2__note" aria-hidden="true">
              {t("hero.note")}
              <DoodleArrow className="hero2__arrow" />
            </p>
            <div className="hero2__card">
              <span className="icon-badge icon-badge--gold icon-badge--sm">
                <Icon name="home" />
              </span>
              <span>
                <strong>
                  <Counter value={stats[0]?.value ?? 0} />
                </strong>
                <small>{t("hero.cardLabel")}</small>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <Marquee words={t.raw("marquee") as string[]} />

      {/* STATS STRIP */}
      <div className="stats-strip">
        <div className="container">
          <Reveal className="stats-strip__card" animation="zoom">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat__value">
                  <Counter value={s.value} suffix={s.suffix} />
                </span>
                <span className="stat__label">{s.label}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>

      {/* ABOUT */}
      <section className="section">
        <div className="container split">
          <Reveal animation="right">
            <div className="collage">
              <div className="media-frame collage__main">
                <Image src="/img/photos/family.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 520px" style={{ objectPosition: "60% center" }} />
              </div>
              <div className="media-frame collage__secondary">
                <Image src="/img/photos/smile.jpg" alt="" fill sizes="(max-width: 960px) 45vw, 260px" />
              </div>
              <div className="collage__badge">
                <span className="icon-badge icon-badge--gold">
                  <Icon name="sprout" />
                </span>
                <div>
                  <strong>{t("about.badgeValue")}</strong>
                  <span>{t("about.badgeLabel")}</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal animation="left">
            <span className="eyebrow">{t("about.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("about.title", richEm)}</h2>
            <p className="lead mt-sm">{t("about.descr")}</p>
            <ul className="check-list mt-md">
              {aboutList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="btn-row mt-md">
              <Link href="/about" className="btn">
                {t("about.explore")} <Icon name="arrowRight" />
              </Link>
              <a href={telHref(SITE.phones[0])} className="btn btn--outline">
                <Icon name="phone" /> {SITE.phones[0]}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WATCH OUR STORY — the documentary and the short clips together */}
      <Wave from="var(--white)" to="var(--navy-900)" />
      {featureFilm || reels.length > 0 ? (
        <section className="section section--navy film-section">
          <div className="container">
            <SectionHead
              eyebrow={tVid("film.eyebrow")}
              title={tVid.rich("film.title", richEm)}
              lead={tVid("film.lead")}
              align="center"
              light
            />
            {featureFilm ? (
              <Reveal animation="zoom">
                <FeatureFilm
                  video={featureFilm}
                  title={featureFilm.title ?? ""}
                  tag={featureFilm.tag ?? ""}
                  playLabel={tVid("film.play")}
                  seal={tVid("film.seal")}
                  closeLabel={tVid("close")}
                />
              </Reveal>
            ) : null}

            {reels.length > 0 ? (
              <Reveal className="film-section__reels">
                <ReelRail
                  reels={reels}
                  watch={tVid("reels.watch")}
                  prev={tVid("reels.prev")}
                  next={tVid("reels.next")}
                  closeLabel={tVid("close")}
                  heading={
                    <div>
                      <span className="eyebrow eyebrow--light">{tVid("reels.eyebrow")}</span>
                      <h3 className="title-md">{tVid.rich("reels.title", richEm)}</h3>
                    </div>
                  }
                />
              </Reveal>
            ) : null}

            <div className="btn-row justify-center mt-md">
              <Link href="/videos" className="btn btn--ghost-light">
                <Icon name="film" /> {tVid("film.more")} <Icon name="arrowRight" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* THE NEED */}
      <section className="section section--navy">
        <div className="container split split--start">
          <Reveal>
            <span className="eyebrow eyebrow--light">{t("need.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("need.title", richEm)}</h2>
            <p className="lead mt-sm">{t("need.lead")}</p>
            <p className="lead mt-sm" style={{ color: "var(--white)" }}>
              {t("need.response")}
            </p>
            <figure className="quote-card mt-md" style={{ margin: "32px 0 0" }}>
              <span className="eyebrow eyebrow--light" style={{ fontStyle: "normal", marginBottom: 12 }}>
                {t("need.visionLabel")}
              </span>
              <blockquote style={{ margin: 0 }}>{t("need.vision")}</blockquote>
            </figure>
          </Reveal>
          <div>
            {challenges.map((c, i) => (
              <Reveal className="challenge" key={c.title} delay={i * 100}>
                <span className="icon-badge icon-badge--navy">
                  <Icon name={c.icon} />
                </span>
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.descr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMS */}
      <Wave from="var(--navy-900)" to="var(--cream)" flip />
      <section className="section section--cream">
        <div className="container">
          <SectionHead
            eyebrow={t("programs.eyebrow")}
            title={t.rich("programs.title", richEm)}
            lead={t("programs.lead")}
            aside={
              <Link href="/programs" className="btn btn--outline">
                {t("programs.cta")} <Icon name="arrowRight" />
              </Link>
            }
          />
          <div className="grid grid-3">
            {programs.map((p, i) => (
              <Reveal key={p.id} delay={i * 100}>
                <article className="program-card">
                  <div className="program-card__media">
                    <Image src={p.image} alt={p.title} fill sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 400px" />
                  </div>
                  <div className="program-card__body">
                    <span className="program-card__icon">
                      <Icon name={p.icon} />
                    </span>
                    <h3>{p.title}</h3>
                    <p>{p.descr}</p>
                    <Link href={`/programs#${p.id}`} className="text-link">
                      {tRoot("common.learnMore")} <Icon name="arrowRight" />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SCRIPTURE */}
      <Scripture />

      {/* PRAY FOR A CHILD */}
      {lukaChildren.length > 0 ? (
        <section className="section section--cream teaser">
          <div className="container">
            <SectionHead
              eyebrow={tGal("luka.homeEyebrow")}
              title={tGal.rich("luka.homeTitle", richEm)}
              lead={tGal("luka.homeLead", { count: lukaChildren.length })}
              align="center"
            />
            <PrayerDeck items={lukaChildren} />
            <div className="btn-row justify-center mt-md">
              <Link href="/gallery/luka" className="btn btn--outline btn--lg">
                <Icon name="users" /> {tGal("luka.homeCta")}
              </Link>
              <Link href="/gallery" className="btn btn--outline btn--lg">
                {tRoot("nav.gallery")} <Icon name="arrowRight" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
      <Wave from="var(--cream)" to="var(--white)" />

      {/* GRATITUDE */}
      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow={t("gratitude.eyebrow")}
            title={t.rich("gratitude.title", richEm)}
            lead={t("gratitude.lead")}
            align="center"
          />
          <div className="grid grid-4">
            {gratitude.map((g, i) => (
              <Reveal key={g.title} delay={i * 80}>
                <div className="card card--hover" style={{ height: "100%" }}>
                  <span className="card__num">0{i + 1}</span>
                  <h3>{g.title}</h3>
                  <p>{g.descr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WAYS TO HELP */}
      <Wave from="var(--white)" to="var(--sand)" />
      <section className="section section--sand">
        <div className="container">
          <SectionHead eyebrow={t("ways.eyebrow")} title={t.rich("ways.title", richEm)} lead={t("ways.lead")} align="center" />
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

      {/* CURRENT NEEDS */}
      <Wave from="var(--sand)" to="var(--white)" flip />
      <section className="section">
        <div className="container split split--start">
          <Reveal animation="right">
            <span className="eyebrow">{t("needs.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("needs.title", richEm)}</h2>
            <p className="lead mt-sm">{t("needs.lead")}</p>
            <div className="media-frame mt-md" style={{ aspectRatio: "4 / 3" }}>
              <Image src="/img/photos/gathering.jpg" alt="" fill sizes="(max-width: 960px) 90vw, 560px" />
            </div>
          </Reveal>
          <Reveal animation="left">
            <Accordion defaultOpenId={needs[0]?.id}>
              {needs.map((n) => (
                <AccordionItem key={n.id} id={n.id} title={n.title}>
                  <p>{n.intro}</p>
                  <ul className="check-list">
                    {n.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                  <Link href="/donations" className="text-link">
                    {t("needs.cta")} <Icon name="arrowRight" />
                  </Link>
                </AccordionItem>
              ))}
              <AccordionItem id="prayer" title={tRoot("involved.pray.eyebrow")}>
                <ul className="dot-list">
                  {prayer.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link href="/get-involved#pray" className="text-link">
                  {ways[0]?.cta} <Icon name="arrowRight" />
                </Link>
              </AccordionItem>
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <Wave from="var(--white)" to="var(--blue-50)" />
      <section className="section section--blue">
        <div className="container">
          <Reveal className="testimonial" animation="zoom">
            <div className="testimonial__media">
              <Image src="/img/photos/drawings.jpg" alt="" fill sizes="(max-width: 860px) 100vw, 480px" />
            </div>
            <div className="testimonial__body">
              <span className="eyebrow">{t("testimonial.eyebrow")}</span>
              <svg className="testimonial__quote-icon" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
                <path d="M20 10C10.6 13.2 5 20.6 5 30.4 5 36.8 8.8 41 14.2 41c4.8 0 8.3-3.6 8.3-8.2 0-4.5-3.2-7.7-7.6-7.7-.9 0-1.6.1-2 .3.9-5.2 4.4-9.6 9.7-12.1L20 10Zm22 0c-9.4 3.2-15 10.6-15 20.4C27 36.8 30.8 41 36.2 41c4.8 0 8.3-3.6 8.3-8.2 0-4.5-3.2-7.7-7.6-7.7-.9 0-1.6.1-2 .3.9-5.2 4.4-9.6 9.7-12.1L42 10Z" />
              </svg>
              <blockquote>{t("testimonial.quote")}</blockquote>
              <cite>— {t("testimonial.author")}</cite>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LATEST POSTS */}
      <Wave from="var(--blue-50)" to="var(--white)" flip />
      {posts.length > 0 ? (
        <section className="section">
          <div className="container">
            <SectionHead
              eyebrow={t("blog.eyebrow")}
              title={t.rich("blog.title", richEm)}
              aside={
                <Link href="/blog" className="btn btn--outline">
                  {t("blog.all")} <Icon name="arrowRight" />
                </Link>
              }
            />
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
