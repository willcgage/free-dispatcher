import { defineConfig } from "drizzle-kit";
import { config } from "./lib/config";

/**
 * drizzle-kit config. Dialect is Postgres (PGlite speaks Postgres); the local
 * driver is PGlite so migrations apply to the on-disk embedded database.
 */
export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: config.dbDataDir,
  },
  strict: true,
  verbose: true,
});
