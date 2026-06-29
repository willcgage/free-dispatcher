/**
 * POST /api/session/archive — archive the active session WITHOUT starting a
 * new one (Admin, spec §3.3). Ends the current event cleanly; the dashboard
 * then shows "no active session" until one is created or reactivated.
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  const archived = await sessionManager.archiveActiveSession(guard.claims.operatorId);
  if (!archived) {
    return NextResponse.json({ error: "no active session to archive" }, { status: 409 });
  }
  return NextResponse.json({ session: archived });
}
