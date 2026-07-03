/**
 * GET /api/track/state — live Block occupancy + active Section allocations for
 *   the active session (any authenticated role) (#80).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;
  return NextResponse.json(await trackModel.getSessionTrackState());
}
