import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Reveal from "@/components/Reveal";
import Icon from "@/components/Icon";
import { SpinBadge } from "@/components/Decor";

/** Closing call-to-action shown at the end of most pages. */
export default function CtaBand() {
  const t = useTranslations("cta");
  const tHero = useTranslations("home.hero");
  return (
    <section className="section section--tight">
      <div className="container">
        <Reveal className="cta-band" animation="zoom">
          <SpinBadge text={tHero("seal")} className="cta-band__seal" />
          <div className="cta-band__inner">
            <div>
              <h2 className="title-md">{t("title")}</h2>
              <p>{t("text")}</p>
            </div>
            <div className="btn-row">
              <Link href="/donations" className="btn btn--gold btn--lg">
                <Icon name="heart" /> {t("donate")}
              </Link>
              <Link href="/get-involved" className="btn btn--ghost-light btn--lg">
                {t("involved")} <Icon name="arrowRight" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
