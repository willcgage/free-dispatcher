/**
 * POST /api/modules/sync — trigger Module Repository catalog sync (admin-only).
 * Returns { synced, lastSyncedAt } on success or { error, message } on failure.
 * Network errors and auth failures leave the existing local catalog intact.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/guard";
import { syncModules } from "@/lib/server/ModuleRepoSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  const result = await syncModules();

  if ("error" in result) {
    const status =
      result.error === "session_expired" ? 401
      : result.error === "no_access" ? 403
      : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
