/**
 * POST /api/zello/tx — relay a PTT transmission start/stop to the session SSE
 * stream so Dispatchers see who is speaking (spec §7.5). Any joined operator.
 * Body: { action: "start" | "stop", channel }
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { tokenFromRequest } from "@/lib/server/sessionToken";
import { db } from "@/lib/db/client";
import { operators } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const claims = tokenFromRequest(req);
  if (!claims) {
    return NextResponse.json({ error: "missing session token" }, { status: 401 });
  }

  let body: { action?: string; channel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "start" && body.action !== "stop") {
    return NextResponse.json(
      { error: "action must be 'start' or 'stop'" },
      { status: 400 },
    );
  }

  const session = await sessionManager.getActiveSession();
  if (!session) {
    return NextResponse.json({ error: "no active session" }, { status: 409 });
  }

  const [op] = await db
    .select()
    .from(operators)
    .where(eq(operators.id, claims.operatorId))
    .limit(1);
  const operatorName = op?.name ?? "Operator";
  const channel = body.channel ?? "";

  await sessionManager.broadcast(
    body.action === "start"
      ? { type: "zello_tx_start", operatorName, channel }
      : { type: "zello_tx_stop", operatorName, channel },
    session.id,
  );
  return NextResponse.json({ ok: true });
}
