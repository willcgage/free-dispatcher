import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

/**
 * Applies every migration to a fresh in-memory database. This guards against
 * malformed or unregistered migrations — e.g. a hand-written file missing its
 * `_journal.json` entry or `--> statement-breakpoint` markers (the cause of the
 * module-sync 500 in #70): the migrator would throw here.
 */
describe("database migrations", () => {
  it("apply cleanly to a fresh database and leave the expected schema", async () => {
    const client = new PGlite(); // in-memory
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: "./lib/db/migrations" });

    const res = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'repo_modules'",
    );
    const cols = res.rows.map((r) => r.column_name);

    // 0004 must have applied: the new length columns exist, the old ones are gone.
    expect(cols).toContain("length_total_inches");
    expect(cols).toContain("mainline_length_inches");
    expect(cols).not.toContain("length_feet");
    expect(cols).not.toContain("length_inches");

    await client.close();
  });
});
