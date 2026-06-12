/**
 * WiThrottle protocol parsing (spec §6). Pure functions, no I/O — unit-testable.
 *
 * The WiThrottle multi-throttle messages we care about (spec §6.2):
 *   MT+L<addr><;><name>   engineer acquired loco <addr>
 *   MT-L<addr><;>r        engineer released loco <addr>
 *   MTA<addr><;>V<speed>  speed update (optional, for status display)
 *
 * General multi-throttle form: M<t><action><addr><;><value>
 *   <t>      single-char throttle id chosen by the client (often 'T')
 *   <action> '+' add/acquire · '-' remove/release · 'A' action (speed/dir/etc)
 *   <addr>   'L'<n> long address or 'S'<n> short address
 */
import type { DccType } from "@/lib/db/schema";

const SEP = "<;>";

export type WiThrottleEvent =
  | { kind: "acquire"; address: number; dccType: DccType; name: string; throttleId: string }
  | { kind: "release"; address: number; dccType: DccType; throttleId: string }
  | { kind: "speed"; address: number; dccType: DccType; speed: number; throttleId: string };

/** Parse one line; returns an event for MT+/MT-/MTA loco messages, else null. */
export function parseWiThrottleLine(line: string): WiThrottleEvent | null {
  if (line.length < 4 || line[0] !== "M") return null;

  const throttleId = line[1];
  const action = line[2];
  const rest = line.slice(3);

  const sepIdx = rest.indexOf(SEP);
  const addrToken = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest;
  const value = sepIdx >= 0 ? rest.slice(sepIdx + SEP.length) : "";

  const m = /^([LS])(\d+)$/.exec(addrToken);
  if (!m) return null;
  const dccType: DccType = m[1] === "L" ? "long" : "short";
  const address = Number(m[2]);

  switch (action) {
    case "+":
      return { kind: "acquire", address, dccType, name: value, throttleId };
    case "-":
      return { kind: "release", address, dccType, throttleId };
    case "A":
      if (value.startsWith("V")) {
        const speed = Number(value.slice(1));
        if (Number.isFinite(speed))
          return { kind: "speed", address, dccType, speed, throttleId };
      }
      return null;
    default:
      return null;
  }
}
