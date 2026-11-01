import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isLocale } from "@/i18n/routing";
import { caveat, fraunces, montserrat, sourceSans, notoEthiopic } from "@/app/fonts";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getSite } from "@/lib/data/site";
import { SiteProvider } from "@/components/SiteProvider";
import Tracker from "@/components/Tracker";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import BackToTop from "@/components/BackToTop";
import ChatLauncher from "@/components/chat/ChatLauncher";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("home.title"), template: `%s · ${t("siteName")}` },
    description: t("home.description"),
    applicationName: SITE_NAME,
  };
}

export const viewport: Viewport = {
  themeColor: "#0b1f36",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  // Enable static rendering.
  setRequestLocale(locale);

  const messages = await getMessages();
  const site = await getSite();
  const t = await getTranslations("common");
  const fontVars = `${caveat.variable} ${fraunces.variable} ${montserrat.variable} ${sourceSans.variable} ${notoEthiopic.variable}`;

  const organization = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/img/omo-beeza-logo-02.png`,
    email: site.email,
    telephone: site.phones[0],
    foundingDate: "2022-09-28",
    address: { "@type": "PostalAddress", addressLocality: "Jinka", addressCountry: "ET" },
    sameAs: Object.values(site.social),
  };

  return (
    <html lang={locale} dir="ltr" className={fontVars}>
      <body>
        <a href="#main" className="skip-link">
          {t("skip")}
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
        <NextIntlClientProvider messages={messages}>
          <SiteProvider site={site}>
          <SmoothScroll>
            <Header />
            <main id="main" className="site-main" tabIndex={-1}>
              {children}
            </main>
            <Footer />
            <BackToTop />
            <ChatLauncher />
            <Tracker />
          </SmoothScroll>
          </SiteProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
