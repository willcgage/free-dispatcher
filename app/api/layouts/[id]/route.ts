/**
 * GET /api/layouts/:id — full District→Section→Block tree for a layout
 *   (any authenticated role).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { asBranches } from "@/lib/track/layoutControlPoints";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const layout = await trackModel.getLayout(id);
  if (!layout) {
    return NextResponse.json({ error: "layout not found" }, { status: 404 });
  }
  return NextResponse.json({ layout });
}

/**
 * PATCH /api/layouts/:id — update a layout's control-point configuration
 * (Admin). Body may carry either or both of:
 *   controlPointDistricts: { [key]: districtId }              (#138)
 *   layoutControlPoints: [{id, name, anchor, offsetInches}]   (#144)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: {
    controlPointDistricts?: Record<string, string>;
    layoutControlPoints?: {
      id: string;
      name: string;
      anchor: string;
      offsetInches: number;
    }[];
    /** Branch-spine definitions (#170). */
    branches?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.controlPointDistricts !== undefined) {
    // Drop empty assignments so cleared control points don't linger.
    const map = Object.fromEntries(
      Object.entries(body.controlPointDistricts ?? {}).filter(([, v]) => v),
    );
    await trackModel.setControlPointDistricts(id, map);
  }
  if (body.layoutControlPoints !== undefined) {
    if (!Array.isArray(body.layoutControlPoints)) {
      return NextResponse.json(
        { error: "layoutControlPoints must be an array" },
        { status: 400 },
      );
    }
    const cps = body.layoutControlPoints.filter(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.anchor === "string" &&
        typeof c.name === "string" &&
        Number.isFinite(c.offsetInches),
    );
    await trackModel.setLayoutControlPoints(id, cps);
  }
  if (body.branches !== undefined) {
    // Branch-spine definitions (#170); junk entries are dropped by the parser.
    await trackModel.setBranches(id, asBranches(body.branches));
  }
  // Re-materialize the sections the control points derive (#146).
  await trackModel.syncDerivedSections(id);
  return NextResponse.json({ ok: true });
}
