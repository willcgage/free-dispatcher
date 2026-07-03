/**
 * GET  /api/layouts — list layouts (any authenticated role).
 * POST /api/layouts — create a layout, optionally with its whole
 *   District→Section→Block tree (Admin). Body: LayoutInput (#80).
 */
import { NextResponse } from "next/server";
import { trackModel, type LayoutInput } from "@/lib/server/TrackModel";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;
  return NextResponse.json({ layouts: await trackModel.listLayouts() });
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: LayoutInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const layout = await trackModel.createLayout(body);
    return NextResponse.json({ layout }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
