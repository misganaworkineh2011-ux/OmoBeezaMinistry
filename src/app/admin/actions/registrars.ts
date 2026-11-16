"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { endRegistrarSessions, registrarInput } from "@/lib/registrars";

// Dashboard → Sub-admins: the same as the Admin app's Sub-admins screen
// (add, edit, extend a target, pause, remove).

type Result = { ok: boolean; error?: string };

const ERRORS: Record<string, string> = {
  invalid_name: "Enter their name.",
  invalid_phone: "Enter a valid Ethiopian mobile number (09… or 07…).",
  weak_password: "The password needs at least 8 characters.",
  invalid_target: "The target must be a number from 0 to 100,000.",
  bad_request: "Something in the form wasn't right.",
};

const done = () => revalidatePath("/admin/subadmins");

export interface RegistrarForm {
  name: string;
  phone: string;
  /** Empty when editing = keep the current password. */
  password: string;
  target: number;
}

export async function addRegistrar(form: RegistrarForm): Promise<Result> {
  const user = await requireUser();
  const input = registrarInput({ ...form }, false);
  if ("error" in input) return { ok: false, error: ERRORS[input.error ?? ""] ?? "Not saved." };
  const v = input.value;
  if (await queryOne("select 1 from registrars where phone = $1", [v.phone])) return { ok: false, error: "A sub-admin with this phone number already exists." };
  await query("insert into registrars (name, phone, password_hash, target, created_by) values ($1, $2, $3, $4, $5)", [
    v.name,
    v.phone,
    await hashPassword(v.password!),
    v.target,
    user.id,
  ]);
  done();
  return { ok: true };
}

export async function updateRegistrar(id: number, form: Partial<RegistrarForm> & { status?: "active" | "paused" }): Promise<Result> {
  await requireUser();
  const input = registrarInput({ ...form }, true);
  if ("error" in input) return { ok: false, error: ERRORS[input.error ?? ""] ?? "Not saved." };
  const v = input.value;
  if (v.phone && (await queryOne("select 1 from registrars where phone = $1 and id <> $2", [v.phone, id]))) {
    return { ok: false, error: "Another sub-admin has this phone number." };
  }
  const hash = v.password ? await hashPassword(v.password) : null;
  const row = await queryOne(
    `update registrars set name = coalesce($2, name), phone = coalesce($3, phone), password_hash = coalesce($4, password_hash),
       target = coalesce($5, target), status = coalesce($6, status)
     where id = $1 returning id`,
    [id, v.name ?? null, v.phone ?? null, hash, v.target ?? null, v.status ?? null],
  );
  if (!row) return { ok: false, error: "That sub-admin no longer exists." };
  // A new password or a pause signs them out of the app and the bot.
  if (hash || v.status === "paused") await endRegistrarSessions(id);
  done();
  return { ok: true };
}

/** Raises a sub-admin's target by `add` (from what they've registered, if that is higher). */
export async function extendRegistrarTarget(id: number, add: number): Promise<Result> {
  await requireUser();
  const n = Math.round(Number(add));
  if (!(n >= 1 && n <= 100_000)) return { ok: false, error: "Enter how many more donors (1 or more)." };
  const row = await queryOne(
    `update registrars set target = least(100000, greatest(target, (select count(*)::int from donors where registered_by = $1)) + $2)
     where id = $1 returning id`,
    [id, n],
  );
  if (!row) return { ok: false, error: "That sub-admin no longer exists." };
  done();
  return { ok: true };
}

export async function removeRegistrar(id: number): Promise<Result> {
  await requireUser();
  await query("delete from registrars where id = $1", [id]);
  done();
  return { ok: true };
}
