/**
 * GET /api/ops-log — rolling operations log for the active session (spec §3.2).
 * Query: ?limit=N (default 50, max 200).
 */
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { opsLog } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await sessionManager.getActiveSession();
  if (!session) return NextResponse.json({ entries: [] });

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 200) : 50;

  const entries = await db
    .select()
    .from(opsLog)
    .where(eq(opsLog.sessionId, session.id))
    .orderBy(desc(opsLog.createdAt))
    .limit(limit);
  return NextResponse.json({ entries });
}
