import "server-only";
import { query } from "@/lib/db";

// The two Android apps, kept in the dashboard (Dashboard → Android apps):
// admins upload a new APK when there is a new version and download the
// current one at any time, e.g. straight onto a phone to install or update it.

export const APPS = {
  admin: {
    name: "Omo Beeza Admin",
    file: "OmoBeezaAdmin",
    package: "org.omobeeza.donors",
    descr: "For the ministry phone: register donors, send SMS reminders, manage sub-admins.",
  },
  subadmin: {
    name: "Omo Beeza Sub-admin",
    file: "OmoBeezaSubAdmin",
    package: "org.omobeeza.subadmin",
    descr: "For sub-admins with an Android phone: they only register donors toward their target.",
  },
} as const;

export type AppKey = keyof typeof APPS;

export const isAppKey = (v: unknown): v is AppKey => v === "admin" || v === "subadmin";

/** Largest APK accepted (the apps are about 2 MB). */
export const MAX_APK_BYTES = 30 * 1024 * 1024;

export interface AppFileInfo {
  app: AppKey;
  version: string;
  file_name: string;
  size: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
}

/** The current upload of each app (without the file itself). */
export async function appFiles(): Promise<Partial<Record<AppKey, AppFileInfo>>> {
  const rows = await query<AppFileInfo>("select app, version, file_name, size, sha256, uploaded_by, uploaded_at from app_files");
  return Object.fromEntries(rows.filter((r) => isAppKey(r.app)).map((r) => [r.app, r]));
}
