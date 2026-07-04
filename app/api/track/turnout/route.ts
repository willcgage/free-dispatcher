/**
 * POST /api/track/turnout — set a turnout's position for the active session
 *   (Admin/Dispatcher/Yardmaster). Body: { turnoutId, position: "normal" | "reversed" }
 *   (#83, manual in v1).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";
import type { TurnoutPosition } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POSITIONS: TurnoutPosition[] = ["normal", "reversed"];

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "yardmaster"]);
  if (!guard.ok) return guard.response;

  let body: { turnoutId?: string; position?: TurnoutPosition };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.turnoutId || !body.position || !POSITIONS.includes(body.position)) {
    return NextResponse.json(
      { error: "turnoutId and position ('normal' | 'reversed') are required" },
      { status: 400 },
    );
  }

  try {
    const row = await trackModel.setTurnoutPosition(
      body.turnoutId,
      body.position,
      guard.claims.operatorId,
    );
    return NextResponse.json({ turnout: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "turnout update failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
