/**
 * Dev seed: one active session with a couple of trains and an operator,
 * so the Phase 1 APIs and SSE have something to return. Idempotent-ish:
 * skips seeding if an active session already exists.
 * Run with `npm run db:seed`.
 */
import { db, pglite } from "./client";
import { sessions, trains, trainStatuses, operators } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db
    .select()
    .from(sessions)
    .where(eq(sessions.status, "active"));

  if (existing.length > 0) {
    console.log("• active session already present, skipping seed");
    await pglite.close();
    return;
  }

  const [session] = await db
    .insert(sessions)
    .values({
      name: "Dev Session — NMRA 2026 Spring Meet",
      date: "2026-06-12",
      venue: "Test Bench",
      status: "active",
    })
    .returning();

  const trainRows = await db
    .insert(trains)
    .values([
      {
        sessionId: session.id,
        number: "101",
        name: "Daylight",
        dccAddress: 4449,
        dccType: "long",
        owner: "Will",
        equipmentType: "passenger",
      },
      {
        sessionId: session.id,
        number: "202",
        name: "Local Freight",
        dccAddress: 22,
        dccType: "short",
        owner: "Will",
        equipmentType: "freight",
      },
    ])
    .returning();

  await db.insert(trainStatuses).values(
    trainRows.map((t) => ({
      trainId: t.id,
      sessionId: session.id,
      status: "yard" as const,
    })),
  );

  await db.insert(operators).values({
    sessionId: session.id,
    name: "Dispatcher Dan",
    role: "dispatcher",
  });

  console.log("✓ seeded active session", session.id);
  await pglite.close();
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
