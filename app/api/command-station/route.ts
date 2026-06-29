/**
 * GET /api/command-station — current command-station adapter + capabilities,
 * so the dashboard can show what Emergency Stop / Off will physically do (#55).
 */
import { NextResponse } from "next/server";
import { commandStation } from "@/lib/commandstation/CommandStationService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(commandStation.status());
}
