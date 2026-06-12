/**
 * GET /api/session — current session state, train roster, modules, operators
 * (spec §5.2). Public read of the active session for any connected client.
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await sessionManager.getFullState();
  return NextResponse.json(state);
}
