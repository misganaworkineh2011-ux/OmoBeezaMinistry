import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadMode } from "@/lib/uploads";
import VideosManager, { type VideoRow } from "@/components/admin/VideosManager";

export const metadata = { title: "Videos" };

export default async function VideosPage() {
  await requireUser();
  const rows = await query<VideoRow>(
    "select id, kind, src, preview, poster, w, h, duration, title_en, title_am, tag_en, tag_am, active from videos order by sort, id",
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Videos</h1>
          <p>The documentary, the short clips and the logo film shown across the site.</p>
        </div>
      </div>
      <VideosManager rows={rows} mode={uploadMode()} />
    </>
  );
}
