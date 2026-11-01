import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import { effectiveMessages, FILE_MESSAGES, isPlainObject, type Messages } from "@/lib/messages";
import { sectionInfo } from "@/lib/admin/sections";
import { ICON_NAMES } from "@/components/Icon";
import ContentEditor from "@/components/admin/ContentEditor";

export default async function ContentSection({ params }: { params: Promise<{ ns: string }> }) {
  await requireUser();
  const { ns } = await params;
  if (!(ns in FILE_MESSAGES.en)) notFound();

  const rows = await query<{ locale: string; ns: string; data: unknown }>("select locale, ns, data from content");
  const overrides: Record<string, Messages> = { en: {}, am: {} };
  for (const r of rows) (overrides[r.locale] ??= {})[r.ns] = r.data;

  const en = effectiveMessages("en", overrides)[ns];
  const am = effectiveMessages("am", overrides)[ns];
  const info = sectionInfo(ns);

  return (
    <>
      <Link href="/admin/content" className="crumb">
        ← Website text
      </Link>
      <div className="page-head">
        <div>
          <h1>{info.title}</h1>
          <p>{info.descr || "Edit this section's text."} English and Amharic appear side by side.</p>
        </div>
      </div>
      <ContentEditor
        key={ns}
        ns={ns}
        initialEn={(isPlainObject(en) ? en : {}) as never}
        initialAm={(isPlainObject(am) ? am : {}) as never}
        edited={rows.some((r) => r.ns === ns)}
        icons={ICON_NAMES}
        mode={uploadMode()}
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ ns: string }> }) {
  const { ns } = await params;
  return { title: sectionInfo(ns).title };
}
