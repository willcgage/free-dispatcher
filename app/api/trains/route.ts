/**
 * GET  /api/trains — all trains in the active session with current status.
 * POST /api/trains — create a train (Admin/Dispatcher); seeds a yard status.
 * (spec §5.2)
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trains, trainStatuses } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";
import type { DccType, EquipmentType } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await sessionManager.getActiveSession();
  if (!session) return NextResponse.json({ trains: [] });

  const [trainRows, statusRows] = await Promise.all([
    db.select().from(trains).where(eq(trains.sessionId, session.id)),
    db.select().from(trainStatuses).where(eq(trainStatuses.sessionId, session.id)),
  ]);
  const statusByTrain = new Map(statusRows.map((s) => [s.trainId, s]));
  return NextResponse.json({
    trains: trainRows.map((t) => ({
      ...t,
      currentStatus: statusByTrain.get(t.id) ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  const session = await sessionManager.getActiveSession();
  if (!session) {
    return NextResponse.json({ error: "no active session" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const number = String(body.number ?? "").trim();
  if (!number) {
    return NextResponse.json({ error: "number is required" }, { status: 400 });
  }

  const [train] = await db
    .insert(trains)
    .values({
      sessionId: session.id,
      number,
      name: body.name ? String(body.name) : null,
      dccAddress:
        body.dccAddress != null ? Number(body.dccAddress) : null,
      dccType: (body.dccType as DccType) ?? null,
      owner: body.owner ? String(body.owner) : null,
      consistId: body.consistId ? String(body.consistId) : null,
      equipmentType: (body.equipmentType as EquipmentType) ?? null,
      assignedOperatorId: body.assignedOperatorId
        ? String(body.assignedOperatorId)
        : null,
    })
    .returning();

  // Seed an initial yard status so the train shows on boards immediately.
  await db.insert(trainStatuses).values({
    trainId: train.id,
    sessionId: session.id,
    status: "yard",
  });

  return NextResponse.json({ train }, { status: 201 });
}
