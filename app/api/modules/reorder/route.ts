/**
 * POST /api/modules/reorder — set the module sequence order for a layout (Admin).
 * Body: { layoutId, orderedIds: string[] } — module_layout row ids in the new
 * order; each row's positionIndex is set to its index. Atomic (#75).
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moduleLayouts } from "@/lib/db/schema";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { layoutId?: string; orderedIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.layoutId?.trim() || !Array.isArray(body.orderedIds)) {
    return NextResponse.json(
      { error: "layoutId and orderedIds[] are required" },
      { status: 400 },
    );
  }

  const layoutId = body.layoutId.trim();
  await db.transaction(async (tx) => {
    for (const [index, id] of body.orderedIds!.entries()) {
      await tx
        .update(moduleLayouts)
        .set({ positionIndex: index })
        .where(
          and(eq(moduleLayouts.id, id), eq(moduleLayouts.layoutId, layoutId)),
        );
    }
  });
  return NextResponse.json({ ok: true });
}
