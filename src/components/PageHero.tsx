import type { ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { localizedPath } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";
import { Link } from "@/i18n/navigation";
import Icon from "@/components/Icon";
import { Wave } from "@/components/Decor";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeroProps {
  title: ReactNode;
  lead?: ReactNode;
  /** Photo shown in an arch frame beside the title (served from /public). */
  image?: string;
  /** Trail after "Home". The current page is added automatically from `current`. */
  trail?: Crumb[];
  current: string;
  /** Background color of the section that follows (for the wave edge). */
  next?: string;
  children?: ReactNode;
}

export default function PageHero({ title, lead, image, trail = [], current, next = "var(--white)", children }: PageHeroProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  // The same trail for search engines (shown as breadcrumbs in Google results).
  const crumbs = [{ label: t("home"), href: "/" }, ...trail, { label: current }];
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${localizedPath(locale, c.href)}` } : {}),
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <section className="page-hero">
        <div className="container page-hero__grid">
          <div className="page-hero__content">
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                <li>
                  <Link href="/">{t("home")}</Link>
                </li>
                {trail.map((c) => (
                  <li key={c.label} style={{ display: "contents" }}>
                    <Icon name="chevronRight" />
                    {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
                  </li>
                ))}
                <li style={{ display: "contents" }}>
                  <Icon name="chevronRight" />
                  <span aria-current="page">{current}</span>
                </li>
              </ol>
            </nav>
            <h1>{title}</h1>
            {lead ? <p className="page-hero__lead">{lead}</p> : null}
            {children}
          </div>
          {image ? (
            <div className="page-hero__art" aria-hidden="true">
              <span className="page-hero__sun" />
              <div className="page-hero__arch">
                <Image src={image} alt="" fill priority sizes="360px" />
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <Wave from="var(--navy-900)" to={next} />
    </>
  );
}
