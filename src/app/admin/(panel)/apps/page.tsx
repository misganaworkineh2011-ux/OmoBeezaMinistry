import { requireUser } from "@/lib/auth";
import { APPS, appFiles, type AppKey } from "@/lib/apps";
import AppsManager from "@/components/admin/AppsManager";

export const metadata = { title: "Android app" };
export const dynamic = "force-dynamic";

export default async function AppsPage() {
  await requireUser();
  const files = await appFiles();
  const apps = (Object.keys(APPS) as AppKey[]).map((key) => ({ key, name: APPS[key].name, descr: APPS[key].descr, file: files[key] ?? null }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Android app</h1>
          <p>Download the app at any time (also straight onto a phone), and upload a new version when there is one.</p>
        </div>
      </div>
      <AppsManager apps={apps} />
    </>
  );
}
