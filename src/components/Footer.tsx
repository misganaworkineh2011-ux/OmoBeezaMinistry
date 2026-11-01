import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FOOTER_INVOLVE, FOOTER_MINISTRY } from "@/lib/nav";
import { LOGO_SRC, telHref } from "@/lib/site";
import { getSite } from "@/lib/data/site";
import Socials from "@/components/Socials";
import NewsletterForm from "@/components/NewsletterForm";
import Icon from "@/components/Icon";
import { Tibeb, Wave } from "@/components/Decor";

export default async function Footer() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tNews = await getTranslations("newsletter");
  const tContact = await getTranslations("contact");
  const SITE = await getSite();
  const year = new Date().getFullYear();

  return (
    <>
    <Wave from="var(--white)" to="var(--navy-950)" />
    <footer className="footer">
      <Tibeb />
      <div className="footer__top">
        <div className="container footer__grid">
          <div>
            <Link href="/" className="footer__logo" aria-label="Omo Beeza Ministry — home">
              <img src={LOGO_SRC} alt="Omo Beeza Ministry" width={146} height={40} />
            </Link>
            <p className="footer__motto">{t("motto")}</p>
            <Socials />
          </div>

          <div>
            <h3>{t("ministry")}</h3>
            <ul className="footer__links">
              {FOOTER_MINISTRY.map((item) => (
                <li key={item.key}>
                  <Link href={item.href}>{tNav(item.key)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>{t("involve")}</h3>
            <ul className="footer__links">
              {FOOTER_INVOLVE.map((item) => (
                <li key={item.key}>
                  <Link href={item.href}>{tNav(item.key)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>{tNews("title")}</h3>
            <p style={{ marginBottom: 16 }}>{tNews("text")}</p>
            <NewsletterForm />
            <ul className="footer__contact">
              <li>
                <Icon name="pin" />
                <span>{tContact("address")}</span>
              </li>
              <li>
                <Icon name="mail" />
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </li>
              <li>
                <Icon name="phone" />
                <span>
                  {SITE.phones.map((phone, i) => (
                    <span key={phone}>
                      {i > 0 ? " · " : null}
                      <a href={telHref(phone)}>{phone}</a>
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <p>
            &copy; {year} {t("rights")} <span aria-hidden="true">·</span> {t("made")}
          </p>
          <div className="footer__legal">
            <Link href="/privacy">{tNav("privacy")}</Link>
            <Link href="/terms">{tNav("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
