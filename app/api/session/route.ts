/**
 * GET /api/session — current session state, train roster, modules, operators
 * (spec §5.2). Public read of the active session for any connected client.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const state = await sessionManager.getFullState();
  return NextResponse.json(state);
}

/**
 * POST /api/session — create & activate a session (Admin, spec §3.3).
 * Any currently-active session is archived first to preserve the singleton.
 * Broadcasts session_start to all connected clients.
 */
export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { name?: string; date?: string; venue?: string; layoutConfigId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Archive the current active session (singleton invariant).
  await db
    .update(sessions)
    .set({ status: "archived" })
    .where(eq(sessions.status, "active"));

  const [session] = await db
    .insert(sessions)
    .values({
      name,
      date: body.date ?? null,
      venue: body.venue ?? null,
      layoutConfigId: body.layoutConfigId ?? null,
      status: "active",
    })
    .returning();

  await sessionManager.broadcast(
    { type: "session_start", sessionId: session.id },
    session.id,
  );
  return NextResponse.json({ session }, { status: 201 });
}
