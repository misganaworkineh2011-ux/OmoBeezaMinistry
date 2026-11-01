import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import { ICON_NAMES } from "@/components/Icon";
import type { AlbumInput } from "@/app/admin/actions/albums";
import AlbumEditor, { type PhotoRow } from "@/components/admin/AlbumEditor";

export const metadata = { title: "Album" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const album = await queryOne<AlbumInput>(
    "select id, title_en, title_am, tag_en, tag_am, descr_en, descr_am, icon from albums where id = $1",
    [id],
  );
  if (!album) notFound();
  const photos = await query<PhotoRow>("select id, src, w, h, caption from photos where album_id = $1 order by sort, id", [id]);

  return (
    <>
      <Link href="/admin/albums" className="crumb">
        ← Photo albums
      </Link>
      <div className="page-head">
        <div>
          <h1>{album.title_en}</h1>
          <p>/gallery/{album.id}</p>
        </div>
      </div>
      <AlbumEditor key={`${album.id}-${photos.length}`} album={album} photos={photos} icons={ICON_NAMES} mode={uploadMode()} />
    </>
  );
}
