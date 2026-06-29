/**
 * CommandStationService — resolves the active command-station adapter and
 * exposes the physical emergency actions to the API layer.
 *
 * Phase 1 selects the adapter from the running WiThrottle connection: when the
 * WiThrottle monitor is enabled we use the JMRI adapter (reflecting live
 * connection state), otherwise the authority-only NullAdapter. Future phases
 * add an explicit `commandStation` setting (type + transport) and more adapters
 * (LCC/OpenLCB, DCC-EX native, Z21, …) without touching callers.
 */
import { wiThrottleService } from "@/lib/withrottle/WiThrottleService";
import { NullAdapter } from "./NullAdapter";
import { JmriAdapter } from "./JmriAdapter";
import type {
  ActionResult,
  CommandStationAdapter,
  CommandStationStatus,
} from "./types";

class CommandStationService {
  private nullAdapter = new NullAdapter();
  private jmriAdapter = new JmriAdapter();

  /** The adapter in effect right now. */
  get active(): CommandStationAdapter {
    return wiThrottleService.enabled ? this.jmriAdapter : this.nullAdapter;
  }

  status(): CommandStationStatus {
    return this.active.status();
  }
  emergencyStop(): ActionResult {
    return this.active.emergencyStop();
  }
  emergencyOff(): ActionResult {
    return this.active.emergencyOff();
  }
  powerOn(): ActionResult {
    return this.active.powerOn();
  }
}

const globalForCs = globalThis as unknown as {
  __fdCommandStation?: CommandStationService;
};

export const commandStation =
  globalForCs.__fdCommandStation ?? new CommandStationService();

if (process.env.NODE_ENV !== "production") {
  globalForCs.__fdCommandStation = commandStation;
}
