"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { hashPassword, passwordProblem, requireUser, verifyPassword } from "@/lib/auth";
import type { FormState } from "@/app/admin/actions/auth";

const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function addAdmin(_prev: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const name = field(data, "name").slice(0, 80);
  const email = field(data, "email").toLowerCase().slice(0, 200);
  const password = String(data.get("password") ?? "");
  if (!name) return { error: "Enter their name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (await queryOne("select 1 from users where lower(email) = $1", [email])) return { error: "An admin with this email already exists." };
  await query("insert into users (email, name, password_hash) values ($1, $2, $3)", [email, name, await hashPassword(password)]);
  revalidatePath("/admin/users");
  return { ok: `${name} can now sign in at /admin with ${email}. Share the password with them privately.` };
}

export async function removeAdmin(id: number): Promise<{ ok: boolean; error?: string }> {
  const me = await requireUser();
  if (id === me.id) return { ok: false, error: "You can’t remove yourself." };
  await query("delete from users where id = $1", [id]);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function changePassword(_prev: FormState, data: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(data.get("current") ?? "");
  const next = String(data.get("next") ?? "");
  const user = await queryOne<{ password_hash: string }>("select password_hash from users where id = $1", [me.id]);
  if (!user || !(await verifyPassword(current, user.password_hash))) return { error: "Your current password is incorrect." };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== String(data.get("confirm") ?? "")) return { error: "The new passwords don’t match." };
  await query("update users set password_hash = $1 where id = $2", [await hashPassword(next), me.id]);
  return { ok: "Password changed." };
}
