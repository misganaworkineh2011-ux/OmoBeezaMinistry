import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import { richEm } from "@/lib/rich";
import { getSite } from "@/lib/data/site";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import DonateForm from "@/components/DonateForm";
import { TIERS } from "@/lib/donations";
import CopyButton from "@/components/CopyButton";
import { Accordion, AccordionItem } from "@/components/Accordion";

interface TrustItem {
  title: string;
  descr: string;
  icon: IconName;
}
interface FaqGroup {
  id: string;
  items: { q: string; a: string }[];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "donations", "/donations");
}

export default async function DonationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const SITE = await getSite();
  const t = await getTranslations("donations");
  const tNav = await getTranslations("nav");
  const tFaq = await getTranslations("faq");

  const trust = t.raw("trust") as TrustItem[];
  const givingFaq = (tFaq.raw("groups") as FaqGroup[]).find((g) => g.id === "giving")?.items ?? [];

  return (
    <>
      <PageHero title={t("hero.title")} lead={t("hero.lead")} image="/img/photos/drawings.jpg" current={tNav("donate")} />

      <section className="section">
        <div className="container donate-layout">
          <div>
            <Reveal>
              <span className="eyebrow">{t("eyebrow")}</span>
              <h2 className="title-lg">{t.rich("title", richEm)}</h2>
              <p className="lead mt-sm">{t("lead")}</p>
            </Reveal>

            <Reveal className="mt-lg">
              <h3 className="title-sm" style={{ marginBottom: 18 }}>
                {t("tiersTitle")}
              </h3>
              <div className="tier-grid">
                {TIERS.map((tier) => (
                  <div className="tier" key={tier}>
                    <strong>${tier}</strong>
                    <span>{t(`impact.${tier}`)}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal className="mt-lg">
              <ul className="trust-list">
                {trust.map((item) => (
                  <li key={item.title}>
                    <span className="icon-badge icon-badge--sm">
                      <Icon name={item.icon} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <span>{item.descr}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="mt-lg">
              <div className="bank-card">
                <div className="bank-card__head">
                  <div>
                    <span className="eyebrow eyebrow--light" style={{ marginBottom: 6 }}>
                      {t("bankTitle")}
                    </span>
                    <p style={{ color: "rgba(255,255,255,.75)" }}>{t("bankIntro")}</p>
                  </div>
                  <span className="bank-card__logo">
                    <img src="/img/berhan-bank-logo.svg" alt={SITE.bank.name} width={131} height={56} />
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>{t("accountNameLabel")}</dt>
                    <dd>{SITE.bank.accountName}</dd>
                  </div>
                  <div>
                    <dt>{t("accountNumberLabel")}</dt>
                    <dd>
                      <span className="bank-card__acct">{SITE.bank.accountNumber}</span>
                      <CopyButton value={SITE.bank.accountNumber} label={t("accountNumberLabel")} />
                    </dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            {givingFaq.length > 0 ? (
              <Reveal className="mt-lg">
                <span className="eyebrow">{t("faqEyebrow")}</span>
                <h2 className="title-md" style={{ marginBottom: 24 }}>
                  {t.rich("faqTitle", richEm)}
                </h2>
                <Accordion>
                  {givingFaq.map((item, i) => (
                    <AccordionItem key={item.q} id={`g-${i}`} title={item.q}>
                      <p>{item.a}</p>
                    </AccordionItem>
                  ))}
                </Accordion>
                <Link href="/faq" className="text-link mt-sm">
                  {t("faqAll")} <Icon name="arrowRight" />
                </Link>
              </Reveal>
            ) : null}
          </div>

          <aside className="donate-layout__aside">
            <div className="donate-card" id="give">
              <div className="donate-card__title">
                <h2>{t("cardTitle")}</h2>
                <span className="donate-card__secure">
                  <Icon name="shield" /> {t("secure")}
                </span>
              </div>
              <DonateForm />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
