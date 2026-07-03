/**
 * POST /api/track/allocate — allocate one or more Sections to a train, in a
 *   direction, for the active session (Admin/Dispatcher). All sections must be
 *   in one District; a section already actively allocated is rejected (#80/#90).
 *   Body: { sectionIds: string[], trainId, direction: "AtoB" | "BtoA" }
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";
import type { SectionDirection } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIRECTIONS: SectionDirection[] = ["AtoB", "BtoA"];

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  let body: {
    sectionIds?: string[];
    trainId?: string;
    direction?: SectionDirection;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.sectionIds) || body.sectionIds.length === 0) {
    return NextResponse.json(
      { error: "sectionIds must be a non-empty array" },
      { status: 400 },
    );
  }
  if (!body.trainId) {
    return NextResponse.json({ error: "trainId is required" }, { status: 400 });
  }
  if (!body.direction || !DIRECTIONS.includes(body.direction)) {
    return NextResponse.json(
      { error: "direction must be 'AtoB' or 'BtoA'" },
      { status: 400 },
    );
  }

  try {
    const allocations = await trackModel.allocateSections(
      body.sectionIds,
      body.trainId,
      body.direction,
      guard.claims.operatorId,
    );
    return NextResponse.json({ allocations }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "allocation failed";
    // Missing/invalid input → 400; conflict or no-session → 409.
    const status = /do not exist|must be in one district/.test(message)
      ? 400
      : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
