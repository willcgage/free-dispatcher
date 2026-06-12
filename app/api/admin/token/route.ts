/**
 * GET /api/admin/token — issues an admin session token to the host UI.
 *
 * Admin is host-only (spec §2): this endpoint only mints a token when running
 * on the host (SERVER_MODE) or in development. It sidesteps the join
 * chicken-and-egg so the Admin UI can create the first session.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { issueToken } from "@/lib/server/sessionToken";
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const allowed = config.serverMode || process.env.NODE_ENV !== "production";
  if (!allowed) {
    return NextResponse.json(
      { error: "admin token available on the host only" },
      { status: 403 },
    );
  }
  const session = await sessionManager.getActiveSession();
  const token = issueToken({
    operatorId: "admin-host",
    sessionId: session?.id ?? "host",
    role: "admin",
    deviceId: "admin-host",
  });
  return NextResponse.json({ sessionToken: token, role: "admin" });
}
