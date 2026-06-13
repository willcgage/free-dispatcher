/**
 * Apply pending Drizzle migrations at server boot.
 *
 * Called from `instrumentation.ts` so a packaged host (Electron, #32) brings its
 * local PGlite schema up to date on launch without the user running any CLI —
 * the `db:migrate` npm script relies on `tsx` + TS source that don't exist in a
 * packaged build. `migrate()` is idempotent (applied migrations are skipped via
 * the journal), so this is safe to run on every start, including in dev.
 *
 * Unlike the one-shot `db:migrate` script this does NOT close the connection —
 * the server keeps using the same lazily-opened PGlite instance.
 */
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { db } from "./client";

let done: Promise<void> | null = null;

export function runMigrations(): Promise<void> {
  // Run at most once per process.
  if (done) return done;
  // Resolve relative to the server's working directory. In dev that's the repo
  // root; in the standalone build the folder is copied alongside the server via
  // `outputFileTracingIncludes` (see next.config.ts), so the same path holds.
  const migrationsFolder = join(process.cwd(), "lib", "db", "migrations");
  done = migrate(db, { migrationsFolder }).then(() => {
    console.log("[freedispatcher] db migrations up to date");
  });
  return done;
}
