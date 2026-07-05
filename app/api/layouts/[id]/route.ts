/**
 * GET /api/layouts/:id — full District→Section→Block tree for a layout
 *   (any authenticated role).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
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
 * PATCH /api/layouts/:id — update a layout's control-point → district
 * assignments (Admin). Body: { controlPointDistricts: { [key]: districtId } }.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { controlPointDistricts?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Drop empty assignments so cleared control points don't linger.
  const map = Object.fromEntries(
    Object.entries(body.controlPointDistricts ?? {}).filter(([, v]) => v),
  );
  await trackModel.setControlPointDistricts(id, map);
  return NextResponse.json({ ok: true });
}
