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

  it("enforces one active allocation per section (track-model partial unique) — #80", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./lib/db/migrations" });

    const L = "00000000-0000-0000-0000-000000000001";
    const D = "00000000-0000-0000-0000-000000000002";
    const S = "00000000-0000-0000-0000-000000000003";
    const SESS = "00000000-0000-0000-0000-000000000004";
    const T1 = "00000000-0000-0000-0000-000000000005";
    const T2 = "00000000-0000-0000-0000-000000000006";

    // Static track model: layout → district → section.
    await client.query(`insert into layouts (id, name) values ('${L}', 'Test Layout')`);
    await client.query(`insert into districts (id, layout_id, name) values ('${D}', '${L}', 'North')`);
    await client.query(`insert into sections (id, district_id, name) values ('${S}', '${D}', 'Sec 1')`);
    // Session + two trains.
    await client.query(`insert into sessions (id, name, layout_id) values ('${SESS}', 'Op', '${L}')`);
    await client.query(`insert into trains (id, session_id, number) values ('${T1}', '${SESS}', '101')`);
    await client.query(`insert into trains (id, session_id, number) values ('${T2}', '${SESS}', '102')`);

    // First active allocation of the section is fine.
    await client.query(
      `insert into section_allocations (session_id, section_id, train_id, direction) values ('${SESS}', '${S}', '${T1}', 'AtoB')`,
    );

    // A second *active* allocation of the same section must be rejected.
    await expect(
      client.query(
        `insert into section_allocations (session_id, section_id, train_id, direction) values ('${SESS}', '${S}', '${T2}', 'BtoA')`,
      ),
    ).rejects.toThrow();

    // A released (inactive) allocation of the same section is allowed.
    await client.query(
      `insert into section_allocations (session_id, section_id, train_id, direction, active) values ('${SESS}', '${S}', '${T2}', 'BtoA', false)`,
    );

    await client.close();
  });

  it("stores one turnout position per session (unique) — #83", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./lib/db/migrations" });

    const L = "00000000-0000-0000-0000-0000000000a1";
    const D = "00000000-0000-0000-0000-0000000000a2";
    const TO = "00000000-0000-0000-0000-0000000000a3";
    const SESS = "00000000-0000-0000-0000-0000000000a4";

    await client.query(`insert into layouts (id, name) values ('${L}', 'L')`);
    await client.query(`insert into districts (id, layout_id, name) values ('${D}', '${L}', 'D')`);
    await client.query(`insert into turnouts (id, district_id, name) values ('${TO}', '${D}', 'Sw 1')`);
    await client.query(`insert into sessions (id, name) values ('${SESS}', 'S')`);

    await client.query(
      `insert into turnout_positions (session_id, turnout_id, position) values ('${SESS}', '${TO}', 'reversed')`,
    );
    // A second position row for the same (session, turnout) is rejected.
    await expect(
      client.query(
        `insert into turnout_positions (session_id, turnout_id, position) values ('${SESS}', '${TO}', 'normal')`,
      ),
    ).rejects.toThrow();

    const res = await client.query<{ position: string }>(
      `select position from turnout_positions where turnout_id = '${TO}'`,
    );
    expect(res.rows[0].position).toBe("reversed");

    await client.close();
  });
});
