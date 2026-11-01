"use server";

import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import type { SiteSettings } from "@/lib/site";

const s = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isUrl = (v: string) => v === "" || /^https:\/\/[^\s]+$/.test(v);

export async function saveSite(input: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const site: SiteSettings = {
    email: s(input.email, 200),
    phones: (input.phones ?? []).map((p) => s(p, 40)).filter(Boolean).slice(0, 6),
    namedContacts: (input.namedContacts ?? [])
      .map((c) => ({ name: s(c?.name, 60), phone: s(c?.phone, 40) }))
      .filter((c) => c.name && c.phone)
      .slice(0, 8),
    bank: { name: s(input.bank?.name, 80), accountName: s(input.bank?.accountName, 120), accountNumber: s(input.bank?.accountNumber, 60) },
    mapEmbed: s(input.mapEmbed, 1000),
    social: {
      telegram: s(input.social?.telegram),
      instagram: s(input.social?.instagram),
      linkedin: s(input.social?.linkedin),
      facebook: s(input.social?.facebook),
    },
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) return { ok: false, error: "Enter a valid email address." };
  if (site.phones.length === 0) return { ok: false, error: "Add at least one phone number." };
  if (!Object.values(site.social).every(isUrl) || !isUrl(site.mapEmbed)) {
    return { ok: false, error: "Links must start with https://" };
  }
  await query(
    `insert into settings (key, data, updated_at) values ('site', $1, now())
     on conflict (key) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(site)],
  );
  refresh("settings");
  return { ok: true };
}
