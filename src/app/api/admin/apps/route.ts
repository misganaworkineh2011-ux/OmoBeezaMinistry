import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { hasDb, query } from "@/lib/db";
import { json } from "@/lib/ratelimit";
import { APPS, isAppKey, MAX_APK_BYTES } from "@/lib/apps";

// POST /api/admin/apps (multipart: app = "admin" | "subadmin", version, file)
// — an admin uploads a new version of one of the Android apps. It replaces the
// previous upload of that app. Signed-in admins only.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "Please sign in again." });
  if (!hasDb()) return json(503, { error: "The database isn't configured." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "The upload didn't arrive. Please try again." });
  }
  const app = form.get("app");
  const file = form.get("file");
  const version = String(form.get("version") ?? "").trim().replace(/^v/i, "").slice(0, 30);
  if (!isAppKey(app)) return json(400, { error: "Choose which app this is." });
  if (!(file instanceof File)) return json(400, { error: "Choose the APK file." });
  if (!/\.apk$/i.test(file.name)) return json(400, { error: "That isn't an APK file (it must end in .apk)." });
  if (file.size > MAX_APK_BYTES) return json(400, { error: "The file is too large (30 MB at most)." });
  if (!/^\d+(\.\d+){0,3}$/.test(version)) return json(400, { error: "Enter the version, like 1.6.0." });

  const bytes = Buffer.from(await file.arrayBuffer());
  // An APK is a ZIP archive: it starts with "PK\x03\x04".
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) return json(400, { error: "That file isn't a valid APK." });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = `${APPS[app].file}-v${version}.apk`;
  await query(
    `insert into app_files (app, version, file_name, size, sha256, data, uploaded_by, uploaded_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (app) do update set version = excluded.version, file_name = excluded.file_name, size = excluded.size,
       sha256 = excluded.sha256, data = excluded.data, uploaded_by = excluded.uploaded_by, uploaded_at = now()`,
    [app, version, fileName, bytes.length, sha256, bytes.toString("base64"), user.name || user.email],
  );
  return json(200, { ok: true, app, version, fileName, size: bytes.length, sha256 });
}
