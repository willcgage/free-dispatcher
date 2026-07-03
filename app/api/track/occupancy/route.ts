/**
 * POST /api/track/occupancy — mark/clear a Block's occupancy for the active
 *   session (Admin/Dispatcher/Yardmaster). Body: { blockId, occupied, trainId? }
 *   (#80, manual in v1).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "yardmaster"]);
  if (!guard.ok) return guard.response;

  let body: { blockId?: string; occupied?: boolean; trainId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.blockId || typeof body.occupied !== "boolean") {
    return NextResponse.json(
      { error: "blockId and boolean occupied are required" },
      { status: 400 },
    );
  }

  try {
    const row = await trackModel.setBlockOccupancy(
      body.blockId,
      body.occupied,
      body.trainId ?? null,
      guard.claims.operatorId,
    );
    return NextResponse.json({ occupancy: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "occupancy update failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
