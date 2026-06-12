/**
 * POST /api/authority/revoke — Dispatcher/Admin revokes authority.
 * Body: { trainId } or { segment } (spec §5.2)
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  let body: { trainId?: string; segment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.trainId && !body.segment) {
    return NextResponse.json(
      { error: "trainId or segment is required" },
      { status: 400 },
    );
  }

  try {
    await sessionManager.revokeAuthority(
      { trainId: body.trainId, segment: body.segment },
      guard.claims.operatorId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "revoke failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
