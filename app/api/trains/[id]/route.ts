/**
 * PATCH  /api/trains/:id — update status/location/notes, or roster fields.
 *   Engineer: own assigned trains only. Dispatcher/Admin: any. (spec §5.2)
 * DELETE /api/trains/:id — remove a train (Admin).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trains } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";
import type { TrainStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRAIN_STATUSES: TrainStatus[] = ["running", "holding", "yard", "staging"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const [train] = await db.select().from(trains).where(eq(trains.id, id)).limit(1);
  if (!train) {
    return NextResponse.json({ error: "train not found" }, { status: 404 });
  }

  // Engineers may only update trains assigned to them.
  if (
    guard.claims.role === "engineer" &&
    train.assignedOperatorId !== guard.claims.operatorId
  ) {
    return NextResponse.json(
      { error: "engineers may only update their assigned trains" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.status && !TRAIN_STATUSES.includes(body.status as TrainStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${TRAIN_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const row = await sessionManager.updateTrainStatus(
    id,
    {
      status: body.status as TrainStatus | undefined,
      locationName:
        body.location !== undefined
          ? (body.location as string | null)
          : undefined,
    },
    guard.claims.operatorId,
  );
  return NextResponse.json({ status: row });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const deleted = await db.delete(trains).where(eq(trains.id, id)).returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "train not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
