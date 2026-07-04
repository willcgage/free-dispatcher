/**
 * POST /api/track/sections/arrange — re-parent and re-order sections across a
 * layout's districts in one shot (Admin, #76). Body:
 *   { sections: { id, districtId, position }[] }
 * Applied atomically; the client sends the full new arrangement after a drag.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sections } from "@/lib/db/schema";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Placement {
  id: string;
  districtId: string;
  position: number;
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { sections?: Placement[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const placements = body.sections;
  if (
    !Array.isArray(placements) ||
    placements.some(
      (p) => !p?.id || !p?.districtId || typeof p.position !== "number",
    )
  ) {
    return NextResponse.json(
      { error: "sections[] of { id, districtId, position } is required" },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    for (const p of placements) {
      await tx
        .update(sections)
        .set({ districtId: p.districtId, position: p.position })
        .where(eq(sections.id, p.id));
    }
  });
  return NextResponse.json({ ok: true });
}
