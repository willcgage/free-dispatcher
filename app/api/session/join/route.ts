/**
 * POST /api/session/join — operator joins the active session (spec §5.2).
 * Body: { name, role, deviceId? }. Returns { sessionToken, state }.
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { issueToken } from "@/lib/server/sessionToken";
import type { OperatorRole } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const ROLES: OperatorRole[] = ["admin", "dispatcher", "engineer", "yardmaster"];

export async function POST(req: Request) {
  let body: { name?: string; role?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const role = body.role as OperatorRole | undefined;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of ${ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  const deviceId = body.deviceId?.trim() || crypto.randomUUID();

  try {
    const { session, operator } = await sessionManager.joinOperator({
      name,
      role,
      deviceId,
    });
    const sessionToken = issueToken({
      operatorId: operator.id,
      sessionId: session.id,
      role: operator.role,
      deviceId,
    });
    const state = await sessionManager.getFullState();
    return NextResponse.json({
      sessionToken,
      deviceId,
      operatorId: operator.id,
      state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "join failed";
    const status = message === "no active session" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
