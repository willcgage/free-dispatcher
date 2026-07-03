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
