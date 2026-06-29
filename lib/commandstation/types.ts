/**
 * Command-station adapter contract (#55).
 *
 * Free Dispatcher's Emergency Stop always revokes dispatch authority; when a
 * command station is connected it ALSO acts on the physical layout through one
 * of these adapters. New control systems (JMRI, LCC/OpenLCB, DCC-EX native,
 * Z21, …) are added as drop-in implementations — nothing else changes.
 *
 * Two semantics, because layouts/operators want both:
 *  - emergencyStop(): halt every locomotive, KEEP track power on (lights/sound
 *    stay; easy recovery). Not all systems can do this globally.
 *  - emergencyOff():  cut track power entirely (the absolute kill switch).
 */

export interface CommandStationCapabilities {
  /** Can stop all locomotives while keeping track power on. */
  emergencyStop: boolean;
  /** Can cut (and restore) track power. */
  emergencyOff: boolean;
}

export interface CommandStationStatus {
  /** Stable id, e.g. "null" | "jmri-withrottle". */
  type: string;
  /** Human label for the UI, e.g. "JMRI / WiThrottle". */
  label: string;
  /** True when the adapter has a live connection able to act physically. */
  connected: boolean;
  capabilities: CommandStationCapabilities;
  /** Connection detail (host:port), when applicable. */
  target: string | null;
}

/** Outcome of a physical action — `applied` distinguishes "did it" from "couldn't". */
export type ActionResult =
  | { applied: true; detail: string }
  | { applied: false; reason: string };

export interface CommandStationAdapter {
  readonly type: string;
  readonly label: string;
  readonly capabilities: CommandStationCapabilities;
  status(): CommandStationStatus;
  /** Stop all locomotives, keep track power on. */
  emergencyStop(): ActionResult;
  /** Cut track power. */
  emergencyOff(): ActionResult;
  /** Restore track power after an emergency off. */
  powerOn(): ActionResult;
}
