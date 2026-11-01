import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import ChildrenManager, { type ChildRow } from "@/components/admin/ChildrenManager";

export const metadata = { title: "Prayer wall" };

export default async function ChildrenPage() {
  await requireUser();
  const rows = await query<ChildRow>(
    `select c.id, c.slug, c.name, c.portrait, c.portrait_w, c.portrait_h, coalesce(c.card, '') as card,
            coalesce(c.card_w, 0) as card_w, coalesce(c.card_h, 0) as card_h, c.active, c.prayers,
            (select count(*)::int from prayer_log p where p.child_slug = c.slug and p.created_at > now() - interval '30 days') as recent
     from children c order by c.sort, c.id`,
  );
  const total = rows.reduce((n, r) => n + r.prayers, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prayer wall</h1>
          <p>
            The children shown on the “Pray for a Child” wall and the home page deck. Visitors have committed to pray{" "}
            <strong>{total.toLocaleString()}</strong> times.
          </p>
        </div>
      </div>
      <ChildrenManager rows={rows} mode={uploadMode()} />
    </>
  );
}
