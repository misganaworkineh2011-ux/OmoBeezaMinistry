import Image from "next/image";
import { useTranslations } from "next-intl";
import Reveal from "@/components/Reveal";
import Parallax from "@/components/Parallax";
import Icon from "@/components/Icon";

export default function Scripture({ image = "/img/photos/family.jpg" }: { image?: string }) {
  const t = useTranslations("scripture");
  return (
    <section className="scripture">
      <div className="scripture__media">
        <Parallax speed={0.15} className="parallax--fill">
          <Image src={image} alt="" fill sizes="100vw" />
        </Parallax>
      </div>
      <div className="container">
        <Reveal>
          <span className="scripture__mark">
            <Icon name="cross" />
          </span>
          <blockquote>{t("quote")}</blockquote>
          <cite>{t("cite")}</cite>
        </Reveal>
      </div>
    </section>
  );
}
