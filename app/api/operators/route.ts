/**
 * GET /api/operators — connected operators in the active session (spec §5.2).
 */
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { operators } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await sessionManager.getActiveSession();
  if (!session) return NextResponse.json({ operators: [] });
  const rows = await db
    .select()
    .from(operators)
    .where(and(eq(operators.sessionId, session.id), isNull(operators.leftAt)));
  return NextResponse.json({ operators: rows, connectedCount: sessionManager.connectedCount });
}
