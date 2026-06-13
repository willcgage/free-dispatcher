/**
 * GET /api/settings        — all admin settings (WiThrottle, server).
 * PUT /api/settings         — upsert one or more settings keys (Admin).
 * Persisted to app_settings; loaded by clients on connect (spec §3.3).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Known settings keys with shapes (documented; storage is generic jsonb). */
const KNOWN_KEYS = ["withrottle", "server"] as const;

export async function GET() {
  const rows = await db.select().from(appSettings);
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return NextResponse.json({ settings: out });
}

export async function PUT(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return NextResponse.json({ error: "no settings provided" }, { status: 400 });
  }

  for (const key of keys) {
    await db
      .insert(appSettings)
      .values({ key, value: body[key] as object })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: body[key] as object, updatedAt: new Date() },
      });
  }

  const rows = await db.select().from(appSettings);
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return NextResponse.json({ settings: out, known: KNOWN_KEYS });
}
