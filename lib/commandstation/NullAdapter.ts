/**
 * NullAdapter — the always-available fallback when no command station is
 * connected. Emergency Stop still revokes authority (handled by the route);
 * this adapter simply reports that nothing physical happened.
 */
import type {
  ActionResult,
  CommandStationAdapter,
  CommandStationStatus,
} from "./types";

const UNAVAILABLE: ActionResult = {
  applied: false,
  reason: "no command station connected — authority revoked only",
};

export class NullAdapter implements CommandStationAdapter {
  readonly type = "null";
  readonly label = "Authority-only (no command station)";
  readonly capabilities = { emergencyStop: false, emergencyOff: false };

  status(): CommandStationStatus {
    return {
      type: this.type,
      label: this.label,
      connected: false,
      capabilities: this.capabilities,
      target: null,
    };
  }

  emergencyStop(): ActionResult {
    return UNAVAILABLE;
  }
  emergencyOff(): ActionResult {
    return UNAVAILABLE;
  }
  powerOn(): ActionResult {
    return { applied: false, reason: "no command station connected" };
  }
}
