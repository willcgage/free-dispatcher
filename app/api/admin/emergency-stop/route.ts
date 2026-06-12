/**
 * POST /api/admin/emergency-stop — Admin/Dispatcher triggers Emergency Stop All:
 * revokes all authority and broadcasts emergency_stop to every client (spec §3.2, §5.2).
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  try {
    await sessionManager.emergencyStop(guard.claims.operatorId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "e-stop failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
