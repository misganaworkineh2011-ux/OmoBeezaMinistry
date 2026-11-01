import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FILE_MESSAGES } from "@/lib/messages";
import { KNOWN_SECTIONS, SECTION_GROUPS } from "@/lib/admin/sections";
import Icon from "@/components/Icon";

export const metadata = { title: "Website text" };

export default async function ContentIndex() {
  await requireUser();
  const rows = await query<{ ns: string; updated_at: string; updated_by: string | null }>(
    "select ns, max(updated_at) as updated_at, max(updated_by) as updated_by from content group by ns",
  );
  const edited = new Map(rows.map((r) => [r.ns, r]));
  const other = Object.keys(FILE_MESSAGES.en).filter((ns) => !KNOWN_SECTIONS.has(ns));
  const groups = other.length
    ? [...SECTION_GROUPS, { title: "Other", sections: other.map((ns) => ({ ns, title: ns, descr: "" })) }]
    : SECTION_GROUPS;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Website text</h1>
          <p>Edit every word on the website, in English and Amharic. Changes go live as soon as you save.</p>
        </div>
      </div>

      {groups.map((group) => (
        <section className="panel" key={group.title}>
          <div className="panel__head">
            <h2>{group.title}</h2>
          </div>
          <div className="grid-cards">
            {group.sections.map((s) => {
              const e = edited.get(s.ns);
              return (
                <Link key={s.ns} href={`/admin/content/${s.ns}`} className="stat-card" style={{ alignItems: "flex-start" }}>
                  <span className="stat-card__icon">
                    <Icon name="book" />
                  </span>
                  <span>
                    <strong style={{ fontSize: "1.02rem" }}>{s.title}</strong>
                    <span>{s.descr}</span>
                    {e ? (
                      <span className="pill pill--blue" style={{ marginTop: 6 }}>
                        Edited {new Date(e.updated_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
