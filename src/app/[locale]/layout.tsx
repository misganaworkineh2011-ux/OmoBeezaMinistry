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
import "../motion.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("home.title"), template: `%s · ${t("siteName")}` },
    description: t("home.description"),
    applicationName: SITE_NAME,
    category: "nonprofit",
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: { telephone: false, email: false, address: false },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    // Google Search Console / Bing Webmaster: paste the code they give into these settings.
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
      ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b1f36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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

  const tMeta = await getTranslations("meta");
  const organization = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NGO",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ["Omo Beeza", "Omo-beeza Ministry", "ኦሞ ቤዛ ሚኒስትሪ"],
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/img/omo-beeza-logo-02.png` },
        image: `${SITE_URL}/og/home.jpg`,
        description: tMeta("home.description"),
        email: site.email,
        telephone: site.phones[0],
        foundingDate: "2022-09-28",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Luqa, Tsemay",
          addressRegion: "South Omo, South Ethiopia",
          addressCountry: "ET",
        },
        areaServed: { "@type": "Place", name: "South Omo, Ethiopia" },
        knowsLanguage: ["en", "am"],
        contactPoint: site.phones.map((p) => ({ "@type": "ContactPoint", telephone: p, contactType: "customer support", areaServed: "ET", availableLanguage: ["English", "Amharic"] })),
        sameAs: Object.values(site.social).filter(Boolean),
        potentialAction: { "@type": "DonateAction", target: `${SITE_URL}/donations`, recipient: { "@id": `${SITE_URL}/#organization` } },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: ["en", "am"],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
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
