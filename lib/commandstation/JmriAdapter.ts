/**
 * JmriAdapter — drives a JMRI (or DCC-EX) server over the WiThrottle protocol,
 * reusing the existing WiThrottle client connection (lib/withrottle).
 *
 * WiThrottle gives a reliable global track-power off/on (`PPA0`/`PPA1`), so
 * emergencyOff() is fully supported. It has NO single "stop all locos but keep
 * power" command — that's a per-throttle action and our client owns no
 * throttles — so emergencyStop() is advertised as unsupported here; the
 * keep-power global arrives with the LCC adapter (Phase 2). The capability flag
 * lets the UI reflect this honestly per active connection.
 */
import { wiThrottleService } from "@/lib/withrottle/WiThrottleService";
import type {
  ActionResult,
  CommandStationAdapter,
  CommandStationStatus,
} from "./types";

export class JmriAdapter implements CommandStationAdapter {
  readonly type = "jmri-withrottle";
  readonly label = "JMRI / WiThrottle";
  readonly capabilities = { emergencyStop: false, emergencyOff: true };

  status(): CommandStationStatus {
    const t = wiThrottleService.target;
    return {
      type: this.type,
      label: this.label,
      connected: wiThrottleService.connected,
      capabilities: this.capabilities,
      target: t ? `${t.host}:${t.port}` : null,
    };
  }

  emergencyStop(): ActionResult {
    return {
      applied: false,
      reason:
        "WiThrottle has no keep-power stop — use Emergency Off, or connect an LCC bus",
    };
  }

  emergencyOff(): ActionResult {
    if (!wiThrottleService.connected) {
      return { applied: false, reason: "WiThrottle server not connected" };
    }
    return wiThrottleService.powerOff()
      ? { applied: true, detail: "track power cut (PPA0)" }
      : { applied: false, reason: "command send failed" };
  }

  powerOn(): ActionResult {
    if (!wiThrottleService.connected) {
      return { applied: false, reason: "WiThrottle server not connected" };
    }
    return wiThrottleService.powerOn()
      ? { applied: true, detail: "track power restored (PPA1)" }
      : { applied: false, reason: "command send failed" };
  }
}
