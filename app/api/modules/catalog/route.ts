/**
 * GET /api/modules/catalog — local Module Repository catalog for the module picker.
 * Returns a lightweight list (no nested jsonb) suitable for search/display.
 * Requires a Free Dispatcher session token (any role); no Module Repo token needed.
 */
import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { repoModules } from "@/lib/db/schema";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;

  const modules = await db
    .select({
      recordNumber: repoModules.recordNumber,
      moduleName: repoModules.moduleName,
      category: repoModules.category,
      geometryType: repoModules.geometryType,
      lengthTotalInches: repoModules.lengthTotalInches,
      mainlineLengthInches: repoModules.mainlineLengthInches,
      endplateCount: repoModules.endplateCount,
      hasMss: repoModules.hasMss,
    })
    .from(repoModules)
    .orderBy(asc(repoModules.recordNumber));

  return NextResponse.json({ modules });
}
