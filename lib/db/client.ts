/**
 * Local database client — embedded PGlite (Postgres) via Drizzle (Q1).
 *
 * Runs in-process inside the Next.js server. No external service, no network,
 * fully offline. The data dir persists to disk under `config.dbDataDir`.
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

// PGlite creates the data dir but not its parent — ensure the parent exists.
if (!globalForDb.__fdPglite) {
  mkdirSync(dirname(config.dbDataDir), { recursive: true });
}

const client =
  globalForDb.__fdPglite ?? new PGlite(config.dbDataDir);

export const db: DbClient =
  globalForDb.__fdDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__fdPglite = client;
  globalForDb.__fdDb = db;
}

export { client as pglite };
