/**
 * WiThrottleService — singleton that runs the monitor and reflects loco
 * acquisitions into session state (spec §6.2–6.4).
 *
 *  - tracks which DCC addresses are currently acquired (in memory)
 *  - on acquire/release, if the address maps to a roster train, broadcasts
 *    train_status_changed so boards + the engineer's settings screen update
 *  - exposes status() for GET /api/withrottle/status
 *
 * Engineer↔train auto-linking from a passive monitor is best-effort: we expose
 * the acquired loco so the Engineer UI shows it; explicit assignment stays in
 * the Admin roster.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trains, trainStatuses } from "@/lib/db/schema";
import { sessionManager } from "@/lib/server/SessionManager";
import {
  WiThrottleMonitor,
  type WiThrottleConnState,
} from "./WiThrottleMonitor";
import type { DccType } from "@/lib/db/schema";

interface AcquiredLoco {
  address: number;
  dccType: DccType;
  name: string;
  at: number;
}

class WiThrottleService {
  private monitor: WiThrottleMonitor | null = null;
  private acquired = new Map<number, AcquiredLoco>();
  private _state: WiThrottleConnState = "disconnected";
  private current: { host: string; port: number } | null = null;

  get enabled(): boolean {
    return this.monitor !== null;
  }

  start(host: string, port: number): void {
    this.stop();
    this.current = { host, port };
    const monitor = new WiThrottleMonitor({ host, port });
    monitor.on("state", (s) => (this._state = s));
    monitor.on("acquire", (e) => {
      this.acquired.set(e.address, {
        address: e.address,
        dccType: e.dccType,
        name: e.name,
        at: Date.now(),
      });
      void this.notifyTrain(e.address);
    });
    monitor.on("release", (e) => {
      this.acquired.delete(e.address);
      void this.notifyTrain(e.address);
    });
    this.monitor = monitor;
    monitor.start();
  }

  stop(): void {
    this.monitor?.stop();
    this.monitor = null;
    this.acquired.clear();
    this._state = "disconnected";
    this.current = null;
  }

  get connected(): boolean {
    return this._state === "connected";
  }

  get target(): { host: string; port: number } | null {
    return this.current;
  }

  /** Cut track power on the connected WiThrottle server (`PPA0`). */
  powerOff(): boolean {
    return this.monitor?.send("PPA0") ?? false;
  }

  /** Restore track power (`PPA1`). */
  powerOn(): boolean {
    return this.monitor?.send("PPA1") ?? false;
  }

  /** Broadcast a train_status_changed if the address maps to a roster train. */
  private async notifyTrain(address: number): Promise<void> {
    const session = await sessionManager.getActiveSession();
    if (!session) return;
    const [train] = await db
      .select()
      .from(trains)
      .where(and(eq(trains.sessionId, session.id), eq(trains.dccAddress, address)))
      .limit(1);
    if (!train) return;
    const [st] = await db
      .select()
      .from(trainStatuses)
      .where(eq(trainStatuses.trainId, train.id))
      .limit(1);
    // Nudge clients to refresh (they refetch full state on this event).
    await sessionManager.broadcast(
      {
        type: "train_status_changed",
        trainId: train.id,
        status: st?.status ?? "yard",
        location: st?.locationName ?? null,
        hasAuthority: st?.hasAuthority ?? false,
      },
      session.id,
    );
  }

  async status() {
    const session = await sessionManager.getActiveSession();
    const roster = session
      ? await db.select().from(trains).where(eq(trains.sessionId, session.id))
      : [];
    const byAddr = new Map(roster.filter((t) => t.dccAddress != null).map((t) => [t.dccAddress!, t]));
    return {
      enabled: this.enabled,
      state: this._state,
      target: this.current,
      acquired: [...this.acquired.values()].map((a) => {
        const train = byAddr.get(a.address);
        return {
          address: a.address,
          dccType: a.dccType,
          name: a.name,
          trainId: train?.id ?? null,
          trainNumber: train?.number ?? null,
        };
      }),
    };
  }
}

const globalForWt = globalThis as unknown as {
  __fdWiThrottle?: WiThrottleService;
};

export const wiThrottleService =
  globalForWt.__fdWiThrottle ?? new WiThrottleService();

if (process.env.NODE_ENV !== "production") {
  globalForWt.__fdWiThrottle = wiThrottleService;
}
