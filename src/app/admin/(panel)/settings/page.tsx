import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { DEFAULT_SITE, type SiteSettings } from "@/lib/site";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata = { title: "Contact & settings" };

export default async function SettingsPage() {
  await requireUser();
  const row = await queryOne<{ data: Partial<SiteSettings> }>("select data from settings where key = 'site'");
  const site = { ...DEFAULT_SITE, ...(row?.data ?? {}) };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contact &amp; settings</h1>
          <p>Contact details, bank account and social links used throughout the website.</p>
        </div>
      </div>
      <SettingsForm initial={site} />
    </>
  );
}
