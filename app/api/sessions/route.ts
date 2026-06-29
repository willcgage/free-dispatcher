/**
 * GET /api/sessions — list all sessions (active + archived), newest first.
 * Admin management view (spec §3.3). The singular /api/session returns only
 * the active session's full state for every client; this is the admin roster.
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  const sessions = await sessionManager.listSessions();
  return NextResponse.json({ sessions });
}
