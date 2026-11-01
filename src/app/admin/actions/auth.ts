"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne, query } from "@/lib/db";
import {
  countUsers,
  createSession,
  destroySession,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "@/lib/auth";
import { limited } from "@/lib/ratelimit";

export interface FormState {
  error?: string;
  ok?: string;
}

async function ip(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function login(_prev: FormState, data: FormData): Promise<FormState> {
  if (limited(`login:${await ip()}`, 8, 15 * 60_000)) {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }
  const email = field(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  const user = await queryOne<{ id: number; password_hash: string }>(
    "select id, password_hash from users where lower(email) = $1",
    [email],
  );
  // Same message either way, so emails can't be discovered.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  redirect("/admin");
}

/** Creates the very first admin account. Only works while there are no users. */
export async function bootstrap(_prev: FormState, data: FormData): Promise<FormState> {
  if (limited(`bootstrap:${await ip()}`, 5, 15 * 60_000)) return { error: "Too many attempts. Please wait." };
  if ((await countUsers()) > 0) return { error: "An admin account already exists. Please sign in." };
  const name = field(data, "name");
  const email = field(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your name and a valid email." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(data.get("confirm") ?? "")) return { error: "The passwords don't match." };

  const rows = await query<{ id: number }>(
    "insert into users (email, name, password_hash) values ($1, $2, $3) returning id",
    [email, name, await hashPassword(password)],
  );
  await createSession(rows[0].id);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
