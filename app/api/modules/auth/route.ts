/**
 * GET    /api/modules/auth — auth status (admin-only)
 * POST   /api/modules/auth — sign in with Module Repo credentials (admin-only)
 * DELETE /api/modules/auth — sign out (admin-only)
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/guard";
import { signIn, signOut, getAuthStatus } from "@/lib/server/ModuleRepoAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  return NextResponse.json(await getAuthStatus());
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.email?.trim() || !body.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  try {
    await signIn(body.email.trim(), body.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sign-in failed" },
      { status: 401 },
    );
  }
}

export async function DELETE(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  await signOut();
  return NextResponse.json({ ok: true });
}
