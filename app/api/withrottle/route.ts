/**
 * GET  /api/withrottle — monitor connection state + acquired locos (spec §6.4).
 * POST /api/withrottle — Admin start/stop the monitor.
 *   Body: { action: "start" | "stop", host?, port? }
 *   On start, host/port fall back to saved app_settings.withrottle.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { wiThrottleService } from "@/lib/withrottle/WiThrottleService";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await wiThrottleService.status());
}

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin"]);
  if (!guard.ok) return guard.response;

  let body: { action?: string; host?: string; port?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.action === "stop") {
    wiThrottleService.stop();
    return NextResponse.json(await wiThrottleService.status());
  }

  if (body.action === "start") {
    let { host, port } = body;
    if (!host || !port) {
      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "withrottle"))
        .limit(1);
      const saved = (row?.value ?? {}) as { host?: string; port?: number };
      host = host ?? saved.host;
      port = port ?? saved.port ?? 12090;
    }
    if (!host) {
      return NextResponse.json(
        { error: "no WiThrottle host configured" },
        { status: 400 },
      );
    }
    wiThrottleService.start(host, port ?? 12090);
    return NextResponse.json(await wiThrottleService.status());
  }

  return NextResponse.json(
    { error: "action must be 'start' or 'stop'" },
    { status: 400 },
  );
}
