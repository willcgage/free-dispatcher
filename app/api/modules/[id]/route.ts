/**
 * DELETE /api/modules/:id — remove a module from the layout (Admin).
 * PATCH  /api/modules/:id — update positionIndex / stagingEnd (Admin, reorder).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moduleLayouts } from "@/lib/db/schema";
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

  let body: { positionIndex?: number; stagingEnd?: StagingEnd | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.positionIndex === "number") set.positionIndex = body.positionIndex;
  if (body.stagingEnd !== undefined) set.stagingEnd = body.stagingEnd;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(moduleLayouts)
    .set(set)
    .where(eq(moduleLayouts.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
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
  return NextResponse.json({ ok: true });
}
