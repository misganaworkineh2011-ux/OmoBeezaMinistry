import { getCurrentUser } from "@/lib/auth";
import { hasDb, queryOne } from "@/lib/db";
import { isAppKey } from "@/lib/apps";

// GET /api/admin/apps/admin — downloads the current APK of the app. Signed-in admins only (open the dashboard on the phone and
// tap Download to install or update the app there).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ app: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in to the dashboard first.", { status: 401 });
  const { app } = await params;
  if (!isAppKey(app) || !hasDb()) return new Response("Not found", { status: 404 });
  const row = await queryOne<{ file_name: string; data: string; sha256: string }>(
    "select file_name, data, sha256 from app_files where app = $1",
    [app],
  );
  if (!row) return new Response("This app hasn't been uploaded yet.", { status: 404 });
  const bytes = Buffer.from(row.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${row.file_name}"`,
      "Cache-Control": "private, no-store",
      ETag: `"${row.sha256}"`,
    },
  });
}
