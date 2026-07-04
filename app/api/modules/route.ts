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

  let body: {
    layoutId?: string;
    moduleId?: string;
    moduleIds?: string[];
    stagingEnd?: StagingEnd;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.layoutId?.trim()) {
    return NextResponse.json({ error: "layoutId is required" }, { status: 400 });
  }

  // Accept a single moduleId or a batch (moduleIds), appended in order.
  const ids = (body.moduleIds ?? (body.moduleId ? [body.moduleId] : []))
    .map((m) => m.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "moduleId or moduleIds is required" },
      { status: 400 },
    );
  }

  const layoutId = body.layoutId.trim();
  const existing = await db
    .select()
    .from(moduleLayouts)
    .where(eq(moduleLayouts.layoutId, layoutId));
  let pos = existing.reduce((m, r) => Math.max(m, r.positionIndex), -1) + 1;

  const rows = await db
    .insert(moduleLayouts)
    .values(
      ids.map((moduleId) => ({
        layoutId,
        moduleId,
        positionIndex: pos++,
        stagingEnd: body.stagingEnd ?? null,
      })),
    )
    .returning();
  return NextResponse.json({ modules: rows }, { status: 201 });
}
