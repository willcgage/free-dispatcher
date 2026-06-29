/**
 * WiThrottleMonitor (spec §6.2) — connects to a WiThrottle server (JMRI /
 * DCC-EX) on port 12090 as a silent client and watches for loco acquire /
 * release / speed events, emitting them for the SessionManager to act on.
 *
 * Best-effort (spec §12): if no WiThrottle server is present the monitor keeps
 * retrying quietly and Free Dispatcher still works with manual assignment.
 *
 * Node-only (uses node:net). Line parsing is delegated to the pure parser so it
 * can be tested without a socket.
 */
import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { parseWiThrottleLine, type WiThrottleEvent } from "./parse";

export interface WiThrottleMonitorOptions {
  host: string;
  port: number;
  clientName?: string;
  reconnectMs?: number;
}

export type WiThrottleConnState = "disconnected" | "connecting" | "connected";

type AcquireEvent = Extract<WiThrottleEvent, { kind: "acquire" }>;
type ReleaseEvent = Extract<WiThrottleEvent, { kind: "release" }>;
type SpeedEvent = Extract<WiThrottleEvent, { kind: "speed" }>;

export class WiThrottleMonitor extends EventEmitter {
  // Typed listener overloads (avoids interface/class declaration merging).
  override on(event: "acquire", l: (e: AcquireEvent) => void): this;
  override on(event: "release", l: (e: ReleaseEvent) => void): this;
  override on(event: "speed", l: (e: SpeedEvent) => void): this;
  override on(event: "state", l: (s: WiThrottleConnState) => void): this;
  override on(event: string, l: (...args: never[]) => void): this {
    return super.on(event, l as (...args: unknown[]) => void);
  }

  private socket: Socket | null = null;
  private buffer = "";
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: WiThrottleConnState = "disconnected";

  constructor(private opts: WiThrottleMonitorOptions) {
    super();
  }

  get state(): WiThrottleConnState {
    return this._state;
  }

  private setState(s: WiThrottleConnState) {
    if (this._state === s) return;
    this._state = s;
    this.emit("state", s);
  }

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
    this.socket = null;
    this.setState("disconnected");
  }

  /**
   * Send a raw WiThrottle command line over the live connection (a newline is
   * appended). Returns false if not currently connected. Used by the JMRI
   * command-station adapter to drive track power (`PPA0`/`PPA1`).
   */
  send(command: string): boolean {
    if (!this.socket || this._state !== "connected") return false;
    return this.socket.write(`${command}\n`);
  }

  private connect(): void {
    if (this.closed) return;
    this.setState("connecting");
    const socket = new Socket();
    this.socket = socket;

    socket.setEncoding("utf8");
    socket.connect(this.opts.port, this.opts.host, () => {
      this.setState("connected");
      // Minimal WiThrottle handshake: announce name + a unique hardware id so
      // the server registers us as a (passive) throttle client.
      const name = this.opts.clientName ?? "FreeDispatcher-Monitor";
      socket.write(`N${name}\n`);
      socket.write(`HUFreeDispatcher-${Date.now()}\n`);
    });

    socket.on("data", (chunk: string) => this.onData(chunk));
    socket.on("error", () => {
      /* swallowed; 'close' schedules a reconnect */
    });
    socket.on("close", () => {
      this.socket = null;
      this.setState("disconnected");
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.opts.reconnectMs ?? 5000;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "");
      this.buffer = this.buffer.slice(nl + 1);
      this.handleLine(line);
    }
  }

  /** Exposed for tests: feed a raw line and emit any parsed event. */
  handleLine(line: string): void {
    const event = parseWiThrottleLine(line);
    if (!event) return;
    this.emit(event.kind, event);
  }
}
