/**
 * Local database client — embedded PGlite (Postgres) via Drizzle (Q1).
 *
 * Runs in-process inside the Next.js server. No external service, no network,
 * fully offline. The data dir persists to disk under `config.dbDataDir`.
 *
 * Initialization is LAZY: PGlite opens on first query, not at module import.
 * This keeps `next build` from touching the database when it imports route
 * modules to read their config (which otherwise causes parallel build workers
 * to fail opening the same data dir).
 *
 * Driver-swap path: to promote to a real Postgres box later, replace this file
 * with `drizzle-orm/node-postgres` + a connection string — schema unchanged.
 *
 * A single PGlite instance is reused across HMR reloads in dev by stashing it
 * on globalThis (Next.js re-evaluates modules on each change).
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { config } from "@/lib/config";
import { schema } from "@/lib/db/schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __fdPglite?: PGlite;
  __fdDb?: DbClient;
};

function init(): { client: PGlite; db: DbClient } {
  if (globalForDb.__fdPglite && globalForDb.__fdDb) {
    return { client: globalForDb.__fdPglite, db: globalForDb.__fdDb };
  }
  // PGlite creates the data dir but not its parent — ensure the parent exists.
  mkdirSync(dirname(config.dbDataDir), { recursive: true });
  const client = new PGlite(config.dbDataDir);
  const db = drizzle(client, { schema });
  globalForDb.__fdPglite = client;
  globalForDb.__fdDb = db;
  return { client, db };
}

/** The raw PGlite instance (for migrations / explicit close). Lazily opened. */
export function getPglite(): PGlite {
  return init().client;
}

/**
 * Drizzle client. A Proxy so the underlying PGlite only opens on first actual
 * use, never at import time.
 */
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const real = init().db as unknown as Record<string | symbol, unknown>;
    return Reflect.get(real, prop, receiver);
  },
});

/** Back-compat alias used by migrate/seed scripts. */
export const pglite = {
  close: async () => {
    if (globalForDb.__fdPglite) await globalForDb.__fdPglite.close();
  },
};
