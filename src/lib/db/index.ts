import "server-only";
import { SCHEMA } from "@/lib/db/schema";

// One tiny query interface over two engines:
//  • Neon Postgres (serverless HTTP driver) when DATABASE_URL is set — used on
//    Vercel and anywhere you point it at Neon.
//  • PGlite (Postgres compiled to WebAssembly, stored in .data/pglite) during
//    local `next dev` without DATABASE_URL, so the dashboard works offline.
// Without either (e.g. a production build with no DATABASE_URL), hasDb() is
// false and the site falls back to its bundled content files.

export type Row = Record<string, unknown>;

interface Engine {
  query(text: string, params: unknown[]): Promise<Row[]>;
}

const globalForDb = globalThis as unknown as {
  __obEngine?: Promise<Engine>;
  __obMigrated?: Promise<void>;
};

function usePglite(): boolean {
  return !process.env.DATABASE_URL && process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL) || usePglite();
}

async function createEngine(): Promise<Engine> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return {
      query: async (text, params) => (await sql.query(text, params)) as Row[],
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dir = `${process.cwd()}/.data/pglite`;
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  return {
    query: async (text, params) => (await pg.query<Row>(text, params)).rows,
  };
}

function engine(): Promise<Engine> {
  if (!hasDb()) throw new Error("No database configured (set DATABASE_URL).");
  globalForDb.__obEngine ??= createEngine();
  return globalForDb.__obEngine;
}

async function migrate(): Promise<void> {
  const db = await engine();
  for (const statement of SCHEMA) await db.query(statement, []);
}

/** Run a parameterized query ($1, $2 …) and return its rows. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await engine();
  globalForDb.__obMigrated ??= migrate().catch((err) => {
    globalForDb.__obMigrated = undefined;
    throw err;
  });
  await globalForDb.__obMigrated;
  return (await db.query(text, params)) as T[];
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Read helper for public pages: returns `fallback` when there is no database
 * or the query fails (so a database hiccup never takes the website down).
 */
export async function safeRead<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDb()) return fallback;
  try {
    return await read();
  } catch (err) {
    console.error("db read failed, using fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}
