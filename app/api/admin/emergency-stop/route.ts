/**
 * POST /api/admin/emergency-stop — Admin/Dispatcher emergency action (spec §3.2,
 * §5.2). Always revokes all dispatch authority and broadcasts emergency_stop;
 * when a command station is connected it ALSO acts on the physical layout via
 * the active adapter (#55).
 *
 * Body: { mode?: "stop" | "off" | "on" }
 *   - "stop" (default): halt locos keeping power (if the station supports it)
 *   - "off":            cut track power
 *   - "on":             restore track power (no authority change)
 */
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/server/SessionManager";
import { commandStation } from "@/lib/commandstation/CommandStationService";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher"]);
  if (!guard.ok) return guard.response;

  const mode = await req
    .json()
    .then((b: { mode?: string }) => b?.mode ?? "stop")
    .catch(() => "stop");

  // "on" only restores power — no authority change.
  if (mode === "on") {
    return NextResponse.json({ ok: true, physical: commandStation.powerOn() });
  }

  // "stop" / "off": revoke authority (the always-on baseline), then act
  // physically through the active adapter.
  try {
    await sessionManager.emergencyStop(guard.claims.operatorId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "e-stop failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const physical =
    mode === "off"
      ? commandStation.emergencyOff()
      : commandStation.emergencyStop();

  return NextResponse.json({ ok: true, authority: "revoked", physical });
}
