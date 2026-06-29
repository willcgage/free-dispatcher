/**
 * PATCH  /api/sessions/:id — reactivate an archived session (Admin). Refused
 *   if another session is already active (the one-active singleton).
 * DELETE /api/sessions/:id — permanently delete an archived session and its
 *   cascade (Admin). The active session must be archived first.
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    const session = await sessionManager.reactivateSession(id);
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reactivate failed";
    const status = message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const result = await sessionManager.deleteSession(id);
  if (result === "not_found") {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (result === "active") {
    return NextResponse.json(
      { error: "cannot delete the active session — archive it first" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
