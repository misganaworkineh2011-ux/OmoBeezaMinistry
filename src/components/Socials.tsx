"use client";

import { useSite } from "@/components/SiteProvider";
import Icon from "@/components/Icon";
import TelegramIcon from "@/components/TelegramIcon";

export default function Socials({ variant = "light" }: { variant?: "light" | "dark" }) {
  const SITE = useSite();
  return (
    <div className={`socials${variant === "dark" ? " socials--dark" : ""}`}>
      <a href={SITE.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer">
        <Icon name="facebook" />
      </a>
      <a href={SITE.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
        <Icon name="instagram" />
      </a>
      <a href={SITE.social.telegram} aria-label="Telegram" target="_blank" rel="noopener noreferrer">
        <TelegramIcon />
      </a>
      <a href={SITE.social.linkedin} aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
        <Icon name="linkedin" />
      </a>
    </div>
  );
}
