import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Icon from "@/components/Icon";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <section className="not-found">
      <div className="container">
        <div className="not-found__code" aria-hidden="true">
          404
        </div>
        <h1>{t("title")}</h1>
        <p>{t("descr")}</p>
        <div className="btn-row">
          <Link href="/" className="btn btn--lg">
            <Icon name="home" /> {t("back")}
          </Link>
          <Link href="/contact" className="btn btn--outline btn--lg">
            {t("contact")} <Icon name="arrowRight" />
          </Link>
        </div>
      </div>
    </section>
  );
}
