/**
 * POST /api/track/release — release every active allocation of a Section for the
 *   active session (Admin/Dispatcher). Body: { sectionId } (#80).
 */
import { NextResponse } from "next/server";
import { trackModel } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  let body: { sectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.sectionId) {
    return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
  }

  try {
    const released = await trackModel.releaseSection(
      body.sectionId,
      guard.claims.operatorId,
    );
    return NextResponse.json({ released });
  } catch (err) {
    const message = err instanceof Error ? err.message : "release failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
