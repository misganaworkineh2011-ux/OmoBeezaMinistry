// Site-wide settings. These defaults are used until an admin saves changes in
// the dashboard (Settings), which are stored in the database and merged over them.

export interface SiteSettings {
  email: string;
  phones: string[];
  namedContacts: { name: string; phone: string }[];
  bank: { name: string; accountName: string; accountNumber: string };
  mapEmbed: string;
  social: { telegram: string; instagram: string; linkedin: string; facebook: string };
}

/** Fixed identity (not editable): used for metadata, sitemap and links. */
export const SITE_NAME = "Omo Beeza Ministry";
export const SITE_URL = "https://omobeezaministry.com";
export const LOGO_SRC = "/img/omo-beeza-logo-02.png";

export const DEFAULT_SITE: SiteSettings = {
  email: "info@omobeezaministry.com",
  phones: ["+251-920-667-122", "+251-919-672-861"],
  namedContacts: [
    { name: "Dibo", phone: "+251-920-667-122" },
    { name: "Tame", phone: "+251-919-672-861" },
  ],
  bank: {
    name: "Berhan Bank",
    accountName: "OMO BEEZA MINISTRY",
    accountNumber: "1601160116595",
  },
  mapEmbed: "https://www.google.com/maps?q=Jinka,+Ethiopia&z=10&output=embed",
  social: {
    telegram: "https://t.me/Omobeeza",
    instagram: "https://www.instagram.com/omo.beeza?igsh=MWU5eXJnc282c3ltbQ==",
    linkedin: "https://www.linkedin.com/company/omo-beeza-ministry",
    facebook: "https://www.facebook.com/profile.php?id=61563024940858",
  },
};

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}
