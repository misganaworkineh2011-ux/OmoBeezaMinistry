import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { telHref } from "@/lib/site";
import { getSite } from "@/lib/data/site";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ContactForm from "@/components/ContactForm";
import Socials from "@/components/Socials";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "contact", "/contact");
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const SITE = await getSite();
  const t = await getTranslations("contact");
  const tNav = await getTranslations("nav");
  const tc = await getTranslations("common");

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} current={tNav("contact")} />

      {/* INFO CARDS */}
      <section className="section section--tight">
        <div className="container grid grid-3">
          <Reveal>
            <div className="contact-card">
              <span className="icon-badge">
                <Icon name="phone" />
              </span>
              <div>
                <span className="contact-card__label">{t("phoneTitle")}</span>
                {SITE.phones.map((phone) => (
                  <a href={telHref(phone)} key={phone}>
                    {phone}
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="contact-card">
              <span className="icon-badge">
                <Icon name="mail" />
              </span>
              <div>
                <span className="contact-card__label">{t("emailTitle")}</span>
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                <span className="muted">{t("hours")}</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="contact-card">
              <span className="icon-badge">
                <Icon name="pin" />
              </span>
              <div>
                <span className="contact-card__label">{t("addressTitle")}</span>
                <span>{t("address")}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FORM + TEAM */}
      <section className="section section--flush-top">
        <div className="container split split--wide-right split--start">
          <Reveal>
            <h2 className="title-md">{t("namedTitle")}</h2>
            <p className="lead mt-sm">{t("namedIntro")}</p>
            <ul className="people">
              {SITE.namedContacts.map((c) => (
                <li key={c.name} className="person">
                  <span className="person__avatar" aria-hidden="true">
                    {c.name.charAt(0)}
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <a href={telHref(c.phone)}>{c.phone}</a>
                  </div>
                  <a href={telHref(c.phone)} className="btn btn--outline btn--sm" aria-label={`${tc("call")} ${c.name}`}>
                    <Icon name="phone" /> {tc("call")}
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="title-sm mt-lg" style={{ marginBottom: 16 }}>
              {t("socialTitle")}
            </h3>
            <Socials variant="dark" />
          </Reveal>
          <Reveal className="form-card" animation="left">
            <h2>{t("formTitle")}</h2>
            <p>{t("formText")}</p>
            <ContactForm />
          </Reveal>
        </div>
      </section>

      {/* MAP */}
      <section className="section section--flush-top">
        <div className="container">
          <Reveal className="map" animation="zoom">
            <iframe
              title={t("mapTitle")}
              src={SITE.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}
