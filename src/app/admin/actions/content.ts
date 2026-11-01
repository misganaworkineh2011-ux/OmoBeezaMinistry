"use server";

import { IntlMessageFormat } from "intl-messageformat";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refresh } from "@/lib/data/cache";
import { FILE_MESSAGES, isPlainObject } from "@/lib/messages";

type Json = unknown;

/** Collect text that would break the site (bad {placeholders} or <tags>). */
function findProblems(node: Json, locale: string, path: string, out: string[]): void {
  if (typeof node === "string") {
    try {
      new IntlMessageFormat(node, locale);
    } catch (err) {
      out.push(`${path}: ${err instanceof Error ? err.message.replace(/_/g, " ").toLowerCase() : "invalid text"}`);
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => findProblems(v, locale, `${path}[${i + 1}]`, out));
  } else if (isPlainObject(node)) {
    for (const [k, v] of Object.entries(node)) findProblems(v, locale, path ? `${path} › ${k}` : k, out);
  }
}

/** Amharic left blank falls back to the English text instead of showing nothing. */
function fillBlanks(am: Json, en: Json): Json {
  if (typeof am === "string") return am.trim() === "" && typeof en === "string" ? en : am;
  if (Array.isArray(am)) return am.map((v, i) => fillBlanks(v, Array.isArray(en) ? en[i] : undefined));
  if (isPlainObject(am)) {
    const enObj = isPlainObject(en) ? en : {};
    return Object.fromEntries(Object.entries(am).map(([k, v]) => [k, fillBlanks(v, enObj[k])]));
  }
  return am;
}

export async function saveContent(ns: string, en: Json, am: Json): Promise<{ ok: boolean; errors?: string[] }> {
  const user = await requireUser();
  if (!(ns in FILE_MESSAGES.en)) return { ok: false, errors: ["Unknown section."] };
  if (!isPlainObject(en) || !isPlainObject(am)) return { ok: false, errors: ["Invalid content."] };
  const amFilled = fillBlanks(am, en);
  const size = JSON.stringify(en).length + JSON.stringify(amFilled).length;
  if (size > 600_000) return { ok: false, errors: ["This section is too large to save."] };

  const errors: string[] = [];
  findProblems(en, "en", "English", errors);
  findProblems(amFilled, "am", "Amharic", errors);
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };

  for (const [locale, data] of [
    ["en", en],
    ["am", amFilled],
  ] as const) {
    await query(
      `insert into content (locale, ns, data, updated_at, updated_by) values ($1, $2, $3, now(), $4)
       on conflict (locale, ns) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`,
      [locale, ns, JSON.stringify(data), user.email],
    );
  }
  refresh("content");
  return { ok: true };
}

/** Throw away dashboard edits for a section and go back to the original text. */
export async function resetContent(ns: string): Promise<{ ok: boolean }> {
  await requireUser();
  await query("delete from content where ns = $1", [ns]);
  refresh("content");
  return { ok: true };
}
