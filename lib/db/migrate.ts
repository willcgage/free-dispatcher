/**
 * Apply pending Drizzle migrations to the local PGlite database.
 * Run with `npm run db:migrate`.
 */
import { migrate } from "drizzle-orm/pglite/migrator";
import { db, pglite } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  await pglite.close();
  console.log("✓ migrations applied to", process.env.FD_DB_DIR ?? "./.data/freedispatcher");
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
