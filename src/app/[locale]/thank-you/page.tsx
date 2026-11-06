import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { dayName, yebunaLink } from "@/lib/giving";
import { getGiving } from "@/lib/data/giving";
import { botUsername } from "@/lib/telegram";
import Icon, { isIconName } from "@/components/Icon";
import Reveal from "@/components/Reveal";
import ShareButtons from "@/components/ShareButtons";
import { SpinBadge, Wave } from "@/components/Decor";

// The page donors land on after giving (from the weekly-giving form, the
// one-time Ye-Buna button, or a Ye-Buna redirect). Optional, personal touches
// come from the address: ?name=Almaz&amount=250&day=3&kind=weekly

// Personalised from the address on every visit, so never pre-built.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { ...(await pageMetadata(locale, "thanks", "/thank-you")), robots: { index: false, follow: true } };
}

interface Step {
  icon: string;
  title: string;
  descr: string;
}

type Search = Promise<{ name?: string; amount?: string; day?: string; kind?: string; tg?: string }>;

// Rising sparks in the hero: fixed positions so server and browser agree.
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 7) % 10) * 0.9,
  duration: 9 + ((i * 5) % 7),
  size: 10 + ((i * 3) % 4) * 4,
  heart: i % 3 === 0,
}));

export default async function ThankYouPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("thanks");
  const sp = await searchParams;

  // Only use what looks like a first name; never echo anything else.
  const name = (sp.name ?? "").replace(/[^\p{L}\p{M}' -]/gu, "").trim().split(/\s+/)[0]?.slice(0, 30) ?? "";
  const amount = Math.round(Number(sp.amount));
  const day = Number(sp.day);
  const weekly = sp.kind === "weekly" && amount > 0 && day >= 0 && day <= 6;
  // The Ye-Buna payment page for their weekly amount (or the general page).
  const yebunaUrl = yebunaLink(await getGiving(), weekly ? amount : undefined);
  // One-tap link to the reminder bot (only for a valid personal token).
  const bot = weekly && /^[A-Za-z0-9_-]{8,40}$/.test(sp.tg ?? "") ? await botUsername() : "";
  const telegramLink = bot ? `https://t.me/${bot}?start=${sp.tg}` : "";
  const steps = t.raw("impact.steps") as Step[];
  const body = t.raw("letter.body") as string[];
  const captions = t.raw("letter.captions") as string[];

  return (
    <>
      <section className="thanks-hero">
        <div className="thanks-hero__sky" aria-hidden="true">
          <span className="thanks-sun" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className={`thanks-spark${s.heart ? " thanks-spark--heart" : ""}`}
              style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s`, width: s.size, height: s.size }}
            >
              {s.heart ? <Icon name="heart" /> : null}
            </span>
          ))}
        </div>

        <div className="container thanks-hero__inner">
          <Reveal animation="zoom">
            <p className="thanks-hero__script">{t("script")}</p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="thanks-hero__title">{name ? t.rich("titleNamed", { ...richEm, name }) : t.rich("titlePlain", richEm)}</h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="thanks-hero__lead">{t("lead")}</p>
          </Reveal>

          <Reveal delay={360} className="thanks-ticket-wrap">
            <div className="thanks-ticket">
              <div className="thanks-ticket__stub">
                <Icon name={weekly ? "repeat" : "gift"} />
                <span>{weekly ? t("ticket.weekly") : t("ticket.once")}</span>
              </div>
              <div className="thanks-ticket__main">
                {weekly ? (
                  <>
                    <strong>
                      {t("ticket.amount", { amount: amount.toLocaleString("en-US") })}{" "}
                      <span>{t("ticket.every", { day: dayName(day, locale) })}</span>
                    </strong>
                    <p>{t("ticket.sms", { day: dayName(day, locale) })}</p>
                    {telegramLink ? (
                      <a className="btn btn--sm thanks-ticket__give thanks-ticket__telegram" href={telegramLink} target="_blank" rel="noopener">
                        <Icon name="telegram" /> {t("ticket.telegram")}
                      </a>
                    ) : null}{" "}
                    {yebunaUrl ? (
                      <a className="btn btn--gold btn--sm thanks-ticket__give" href={yebunaUrl} target="_blank" rel="noopener">
                        <Icon name="heart" /> {t("ticket.giveNow")} <Icon name="arrowRight" />
                      </a>
                    ) : null}
                  </>
                ) : (
                  <p className="thanks-ticket__once">{t("ticket.onceNote")}</p>
                )}
              </div>
              <SpinBadge text={t("ticket.seal")} className="thanks-ticket__seal" />
            </div>
          </Reveal>
        </div>
      </section>
      <Wave from="var(--navy-900)" to="var(--cream)" />

      {/* A letter from the field, beside a few snapshots. */}
      <section className="section thanks-letter-section">
        <div className="container thanks-letter-grid">
          <Reveal animation="left" className="thanks-polaroids">
            {[
              { src: "/img/photos/group.jpg", cls: "a" },
              { src: "/img/photos/smile.jpg", cls: "b" },
              { src: "/img/photos/classroom.jpg", cls: "c" },
            ].map((p, i) => (
              <figure key={p.src} className={`thanks-polaroid thanks-polaroid--${p.cls}`}>
                <span className="thanks-polaroid__tape" aria-hidden="true" />
                <div className="thanks-polaroid__img">
                  <Image src={p.src} alt="" fill sizes="(max-width: 900px) 60vw, 320px" />
                </div>
                <figcaption>{captions[i]}</figcaption>
              </figure>
            ))}
          </Reveal>

          <Reveal animation="right" className="thanks-letter">
            <span className="eyebrow">{t("letter.eyebrow")}</span>
            <p className="thanks-letter__greeting">{t("letter.greeting")}</p>
            {body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="thanks-letter__signoff">{t("letter.signoff")}</p>
            <p className="thanks-letter__signature">{t("letter.signature")}</p>
            <svg className="thanks-letter__flourish" viewBox="0 0 220 24" aria-hidden="true">
              <path d="M4 16 C 40 2, 70 26, 110 12 S 180 2, 216 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="thanks-letter__place">
              <Icon name="pin" /> {t("letter.place")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* What the gift sets in motion. */}
      <section className="section thanks-impact">
        <div className="container">
          <Reveal className="thanks-impact__head">
            <span className="eyebrow">{t("impact.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("impact.title", richEm)}</h2>
          </Reveal>
          <ol className="thanks-steps">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={(i + 1) * 120} className="thanks-step">
                <span className="thanks-step__num">{i + 1}</span>
                <span className="thanks-step__icon">
                  <Icon name={isIconName(s.icon) ? s.icon : "heart"} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.descr}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* A verse for the giver. */}
      <section className="thanks-verse">
        <div className="container">
          <Reveal>
            <span className="thanks-verse__mark" aria-hidden="true">
              <Icon name="cross" />
            </span>
            <blockquote>{t("verse.quote")}</blockquote>
            <cite>{t("verse.cite")}</cite>
          </Reveal>
        </div>
      </section>

      {/* Ways to keep going. */}
      <section className="section">
        <div className="container">
          <Reveal className="thanks-impact__head">
            <span className="eyebrow">{t("next.eyebrow")}</span>
            <h2 className="title-lg">{t.rich("next.title", richEm)}</h2>
          </Reveal>
          <div className="thanks-next">
            <Reveal delay={120} className="thanks-card thanks-card--share">
              <span className="thanks-card__icon">
                <Icon name="send" />
              </span>
              <h3>{t("next.shareTitle")}</h3>
              <p>{t("next.shareDescr")}</p>
              <ShareButtons title={t("next.shareText")} path={locale === "am" ? "/am/donations" : "/donations"} />
            </Reveal>
            <Reveal delay={240} className="thanks-card">
              <span className="thanks-card__icon">
                <Icon name="handHeart" />
              </span>
              <h3>{t("next.prayTitle")}</h3>
              <p>{t("next.prayDescr")}</p>
              <Link href="/gallery/luka" className="text-link">
                {t("next.prayCta")} <Icon name="arrowRight" />
              </Link>
            </Reveal>
            <Reveal delay={360} className="thanks-card">
              <span className="thanks-card__icon">
                <Icon name="film" />
              </span>
              <h3>{t("next.watchTitle")}</h3>
              <p>{t("next.watchDescr")}</p>
              <Link href="/videos" className="text-link">
                {t("next.watchCta")} <Icon name="arrowRight" />
              </Link>
            </Reveal>
          </div>
          <div className="btn-row thanks-actions">
            <Link href="/" className="btn btn--lg">
              <Icon name="home" /> {t("home")}
            </Link>
            <Link href="/donations" className="btn btn--outline btn--lg">
              <Icon name="heart" /> {t("giveAgain")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
