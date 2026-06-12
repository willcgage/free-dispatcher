/**
 * Admin Zello developer credentials (issuer + private key).
 *   GET    — status only: { configured, issuer? }. Never returns the key.
 *   POST   — { issuer, privateKey } → saved to the local creds file.
 *   DELETE — clears the saved credentials.
 * Host-only: gated to admin tokens (admin runs on the host machine).
 */
import { NextResponse } from "next/server";
import {
  readZelloCredentials,
  writeZelloCredentials,
  clearZelloCredentials,
  effectiveZelloCredentials,
} from "@/lib/zello/credentials";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  const eff = effectiveZelloCredentials();
  const fromFile = readZelloCredentials();
  return NextResponse.json({
    configured: Boolean(eff),
    issuer: eff?.issuer ?? null, // issuer is an identifier, safe to show admin
    source: fromFile ? "file" : eff ? "env" : "none",
  });
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { issuer?: string; privateKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const issuer = body.issuer?.trim();
  // Accept keys pasted with literal "\n" (single-line) or real newlines.
  const privateKey = body.privateKey?.replace(/\\n/g, "\n").trim();
  if (!issuer || !privateKey) {
    return NextResponse.json(
      { error: "issuer and privateKey are required" },
      { status: 400 },
    );
  }
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey)) {
    return NextResponse.json(
      { error: "privateKey does not look like a PEM private key" },
      { status: 400 },
    );
  }

  try {
    writeZelloCredentials({ issuer, privateKey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to save credentials" },
      { status: 500 },
    );
  }
  return NextResponse.json({ configured: true, issuer, source: "file" });
}

export async function DELETE(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;
  clearZelloCredentials();
  return NextResponse.json({ configured: false });
}
