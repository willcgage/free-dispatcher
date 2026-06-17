/**
 * GET /api/server-info — host IP, port, server URL, a scannable QR code, and
 * the list of LAN interfaces (spec §3.1). `scheme` toggles http/https; `host`
 * selects which interface IP the url/QR point at (must be a real interface).
 */
import { NextResponse } from "next/server";
import { serverInfo } from "@/lib/server/advertise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const scheme = params.get("scheme") === "https" ? "https" : "http";
  const host = params.get("host") ?? undefined;
  return NextResponse.json(await serverInfo(scheme, host));
}
