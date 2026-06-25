/**
 * GET  /api/modules — module layout for the active session in track order.
 * POST /api/modules — append a module to the linear layout (Admin).
 *   Body: { moduleId, stagingEnd? }
 * (spec §3.3 module layout configuration)
 */
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moduleLayouts, repoModules } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";
import type { StagingEnd } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await sessionManager.getActiveSession();
  if (!session) return NextResponse.json({ modules: [] });
  const modules = await db
    .select({
      id: moduleLayouts.id,
      sessionId: moduleLayouts.sessionId,
      moduleId: moduleLayouts.moduleId,
      positionIndex: moduleLayouts.positionIndex,
      stagingEnd: moduleLayouts.stagingEnd,
      moduleName: repoModules.moduleName,
    })
    .from(moduleLayouts)
    .leftJoin(repoModules, eq(moduleLayouts.moduleId, repoModules.recordNumber))
    .where(eq(moduleLayouts.sessionId, session.id))
    .orderBy(asc(moduleLayouts.positionIndex));
  return NextResponse.json({ modules });
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  const session = await sessionManager.getActiveSession();
  if (!session) {
    return NextResponse.json({ error: "no active session" }, { status: 409 });
  }

  let body: { moduleId?: string; stagingEnd?: StagingEnd };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.moduleId?.trim()) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(moduleLayouts)
    .where(eq(moduleLayouts.sessionId, session.id));
  const nextPos = existing.reduce((m, r) => Math.max(m, r.positionIndex), -1) + 1;

  const [row] = await db
    .insert(moduleLayouts)
    .values({
      sessionId: session.id,
      moduleId: body.moduleId.trim(),
      positionIndex: nextPos,
      stagingEnd: body.stagingEnd ?? null,
    })
    .returning();
  return NextResponse.json({ module: row }, { status: 201 });
}
