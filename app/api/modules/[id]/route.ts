/**
 * DELETE /api/modules/:id — remove a module from the layout (Admin).
 * PATCH  /api/modules/:id — update positionIndex / stagingEnd (Admin, reorder).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moduleLayouts, repoModules } from "@/lib/db/schema";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";
import type { StagingEnd } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: {
    positionIndex?: number;
    stagingEnd?: StagingEnd | null;
    flipped?: boolean;
    /** Mirrored/flipped placement for the footprint solver (#175). */
    mirrored?: boolean;
    /** Replace the placement with another catalog module (#158). */
    moduleId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.positionIndex === "number") set.positionIndex = body.positionIndex;
  if (body.stagingEnd !== undefined) set.stagingEnd = body.stagingEnd;
  if (typeof body.flipped === "boolean") set.flipped = body.flipped;
  if (typeof body.mirrored === "boolean") set.mirrored = body.mirrored;
  if (typeof body.moduleId === "string" && body.moduleId.trim()) {
    const rec = body.moduleId.trim();
    const [target] = await db
      .select({ recordNumber: repoModules.recordNumber })
      .from(repoModules)
      .where(eq(repoModules.recordNumber, rec));
    if (!target) {
      return NextResponse.json(
        { error: `module ${rec} is not in the local catalog` },
        { status: 400 },
      );
    }
    set.moduleId = rec;
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(moduleLayouts)
    .set(set)
    .where(eq(moduleLayouts.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (set.moduleId) {
    // The spine's control points changed — re-materialize sections (#146).
    await trackModel.syncDerivedSections(row.layoutId);
  }
  return NextResponse.json({ module: row });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const deleted = await db
    .delete(moduleLayouts)
    .where(eq(moduleLayouts.id, id))
    .returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // The module list changed → re-materialize control-point sections (#146).
  await trackModel.syncDerivedSections(deleted[0].layoutId);
  return NextResponse.json({ ok: true });
}
