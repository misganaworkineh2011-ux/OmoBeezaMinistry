import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AlbumsList, { type AlbumSummary } from "@/components/admin/AlbumsList";

export const metadata = { title: "Photo albums" };

export default async function AlbumsPage() {
  await requireUser();
  const albums = await query<AlbumSummary>(
    `select a.id, a.title_en, a.icon,
            (select count(*)::int from photos p where p.album_id = a.id) as count,
            (select p.src from photos p where p.album_id = a.id order by p.sort, p.id limit 1) as cover
     from albums a order by a.sort, a.created_at`,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Photo albums</h1>
          <p>Event albums shown on the Gallery page. Create an album, then upload its photos.</p>
        </div>
      </div>
      <AlbumsList albums={albums} />
    </>
  );
}
