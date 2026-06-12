/**
 * SessionManager (spec file manifest + §3.3, §5.1).
 *
 * In-memory hub for the single active session:
 *  - holds the set of connected SSE clients and broadcasts FdEvents to them
 *  - provides session helpers (active session, full state, operator join/leave)
 *  - writes an ops_log row for every broadcast so the Admin log is durable
 *
 * State of record lives in the local DB (PGlite); this class is the realtime
 * fan-out layer on top of it. A single instance is reused across HMR via
 * globalThis, mirroring the db client.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  sessions,
  trains,
  trainStatuses,
  operators,
  moduleLayouts,
  opsLog,
  type OperatorRole,
} from "@/lib/db/schema";
import type { FdEvent } from "./events";

type Client = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

class SessionManager {
  private clients = new Map<string, Client>();
  private encoder = new TextEncoder();

  // ---- SSE fan-out -------------------------------------------------------

  /** Register a client controller; returns an unregister function. */
  addClient(controller: ReadableStreamDefaultController<Uint8Array>): {
    id: string;
    remove: () => void;
  } {
    const id = crypto.randomUUID();
    this.clients.set(id, { id, controller });
    return { id, remove: () => this.clients.delete(id) };
  }

  get connectedCount(): number {
    return this.clients.size;
  }

  /** Encode and send a single event to one controller. */
  private send(client: Client, event: FdEvent): void {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    try {
      client.controller.enqueue(this.encoder.encode(frame));
    } catch {
      this.clients.delete(client.id);
    }
  }

  /** Send a raw comment line (used for keepalive pings). */
  ping(): void {
    const frame = this.encoder.encode(`: ping\n\n`);
    for (const client of this.clients.values()) {
      try {
        client.controller.enqueue(frame);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  /**
   * Broadcast an event to every connected client and persist it to ops_log.
   * `sessionId` is required for the durable log entry.
   */
  async broadcast(event: FdEvent, sessionId: string): Promise<void> {
    for (const client of this.clients.values()) this.send(client, event);
    try {
      await db.insert(opsLog).values({
        sessionId,
        eventType: event.type,
        payload: event,
      });
    } catch {
      // ops_log is best-effort; never block the live broadcast on it.
    }
  }

  // ---- Session helpers ---------------------------------------------------

  /** The single active session, or null if none is active. */
  async getActiveSession() {
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.status, "active"))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Full session state for GET /api/session (spec §5.2). */
  async getFullState() {
    const session = await this.getActiveSession();
    if (!session) {
      return { session: null, trains: [], operators: [], modules: [] };
    }
    const [trainRows, statusRows, operatorRows, moduleRows] = await Promise.all([
      db.select().from(trains).where(eq(trains.sessionId, session.id)),
      db
        .select()
        .from(trainStatuses)
        .where(eq(trainStatuses.sessionId, session.id)),
      db
        .select()
        .from(operators)
        .where(
          and(
            eq(operators.sessionId, session.id),
            isNull(operators.leftAt),
          ),
        ),
      db
        .select()
        .from(moduleLayouts)
        .where(eq(moduleLayouts.sessionId, session.id)),
    ]);

    const statusByTrain = new Map(statusRows.map((s) => [s.trainId, s]));
    return {
      session,
      trains: trainRows.map((t) => ({
        ...t,
        currentStatus: statusByTrain.get(t.id) ?? null,
      })),
      operators: operatorRows,
      modules: moduleRows.sort((a, b) => a.positionIndex - b.positionIndex),
      connectedCount: this.connectedCount,
    };
  }

  /** Operator joins the active session (spec §4.1). Returns the operator row. */
  async joinOperator(input: {
    name: string;
    role: OperatorRole;
    deviceId: string;
  }) {
    const session = await this.getActiveSession();
    if (!session) throw new Error("no active session");

    const [op] = await db
      .insert(operators)
      .values({
        sessionId: session.id,
        name: input.name,
        role: input.role,
        deviceId: input.deviceId,
      })
      .returning();

    await this.broadcast(
      {
        type: "operator_joined",
        name: op.name,
        role: op.role,
        deviceId: input.deviceId,
      },
      session.id,
    );
    return { session, operator: op };
  }
}

const globalForSm = globalThis as unknown as {
  __fdSessionManager?: SessionManager;
};

export const sessionManager =
  globalForSm.__fdSessionManager ?? new SessionManager();

if (process.env.NODE_ENV !== "production") {
  globalForSm.__fdSessionManager = sessionManager;
}
