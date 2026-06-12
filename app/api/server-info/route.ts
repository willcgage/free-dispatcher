/**
 * GET /api/server-info — host IP, port, server URL, and a scannable QR code
 * for the Admin header (spec §3.1). `scheme` query param toggles http/https.
 */
import { NextResponse } from "next/server";
import { serverInfo } from "@/lib/server/advertise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const scheme =
    new URL(req.url).searchParams.get("scheme") === "https" ? "https" : "http";
  return NextResponse.json(await serverInfo(scheme));
}
