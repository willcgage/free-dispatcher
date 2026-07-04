/**
 * GET  /api/modules?layoutId=... — module sequence for a layout in track order.
 *   Without layoutId, falls back to the active session's layout.
 * POST /api/modules — append a module to a layout's sequence (Admin).
 *   Body: { layoutId, moduleId, stagingEnd? }
 * A layout owns its module sequence (#84); a session runs on the layout.
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  let layoutId = url.searchParams.get("layoutId");
  if (!layoutId) {
    const session = await sessionManager.getActiveSession();
    layoutId = session?.layoutId ?? null;
  }
  if (!layoutId) return NextResponse.json({ modules: [] });

  const modules = await db
    .select({
      id: moduleLayouts.id,
      layoutId: moduleLayouts.layoutId,
      moduleId: moduleLayouts.moduleId,
      positionIndex: moduleLayouts.positionIndex,
      stagingEnd: moduleLayouts.stagingEnd,
      moduleName: repoModules.moduleName,
    })
    .from(moduleLayouts)
    .leftJoin(repoModules, eq(moduleLayouts.moduleId, repoModules.recordNumber))
    .where(eq(moduleLayouts.layoutId, layoutId))
    .orderBy(asc(moduleLayouts.positionIndex));
  return NextResponse.json({ modules });
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { layoutId?: string; moduleId?: string; stagingEnd?: StagingEnd };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.layoutId?.trim()) {
    return NextResponse.json({ error: "layoutId is required" }, { status: 400 });
  }
  if (!body.moduleId?.trim()) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
  }

  const layoutId = body.layoutId.trim();
  const existing = await db
    .select()
    .from(moduleLayouts)
    .where(eq(moduleLayouts.layoutId, layoutId));
  const nextPos = existing.reduce((m, r) => Math.max(m, r.positionIndex), -1) + 1;

  const [row] = await db
    .insert(moduleLayouts)
    .values({
      layoutId,
      moduleId: body.moduleId.trim(),
      positionIndex: nextPos,
      stagingEnd: body.stagingEnd ?? null,
    })
    .returning();
  return NextResponse.json({ module: row }, { status: 201 });
}
