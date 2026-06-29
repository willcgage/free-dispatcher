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
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  sessions,
  trains,
  trainStatuses,
  authorityLog,
  operators,
  moduleLayouts,
  opsLog,
  type OperatorRole,
  type TrainStatus,
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

  /** Mark an operator as left and broadcast (spec §3.3 force-disconnect / leave). */
  async leaveOperator(deviceId: string): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) return;
    await db
      .update(operators)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(operators.sessionId, session.id),
          eq(operators.deviceId, deviceId),
          isNull(operators.leftAt),
        ),
      );
    await this.broadcast({ type: "operator_left", deviceId }, session.id);
  }

  // ---- Train status & authority -----------------------------------------

  /**
   * Update a train's current status row (status / location / authority) and
   * broadcast train_status_changed. Upserts the train_statuses row if missing.
   */
  async updateTrainStatus(
    trainId: string,
    patch: {
      status?: TrainStatus;
      locationName?: string | null;
      hasAuthority?: boolean;
    },
    updatedBy: string | null,
  ) {
    const session = await this.getActiveSession();
    if (!session) throw new Error("no active session");

    const existing = await db
      .select()
      .from(trainStatuses)
      .where(eq(trainStatuses.trainId, trainId))
      .limit(1);

    let row;
    if (existing[0]) {
      [row] = await db
        .update(trainStatuses)
        .set({ ...patch, updatedBy, updatedAt: new Date() })
        .where(eq(trainStatuses.id, existing[0].id))
        .returning();
    } else {
      [row] = await db
        .insert(trainStatuses)
        .values({
          trainId,
          sessionId: session.id,
          status: patch.status ?? "yard",
          locationName: patch.locationName ?? null,
          hasAuthority: patch.hasAuthority ?? false,
          updatedBy,
        })
        .returning();
    }

    await this.broadcast(
      {
        type: "train_status_changed",
        trainId,
        status: row.status,
        location: row.locationName,
        hasAuthority: row.hasAuthority,
      },
      session.id,
    );
    return row;
  }

  /** Grant track authority to a train (Dispatcher/Admin). */
  async grantAuthority(
    trainId: string,
    segment: string | null,
    byOperator: string | null,
  ) {
    const session = await this.getActiveSession();
    if (!session) throw new Error("no active session");

    await db
      .update(trainStatuses)
      .set({ hasAuthority: true, updatedAt: new Date() })
      .where(eq(trainStatuses.trainId, trainId));
    await db
      .insert(authorityLog)
      .values({ sessionId: session.id, trainId, segment, action: "granted", byOperator });

    await this.broadcast(
      { type: "authority_granted", trainId, segment, grantedBy: byOperator },
      session.id,
    );
  }

  /** Revoke authority by train or segment (Dispatcher/Admin). */
  async revokeAuthority(
    target: { trainId?: string; segment?: string },
    byOperator: string | null,
  ) {
    const session = await this.getActiveSession();
    if (!session) throw new Error("no active session");

    if (target.trainId) {
      await db
        .update(trainStatuses)
        .set({ hasAuthority: false, updatedAt: new Date() })
        .where(eq(trainStatuses.trainId, target.trainId));
    }
    await db.insert(authorityLog).values({
      sessionId: session.id,
      trainId: target.trainId ?? null,
      segment: target.segment ?? null,
      action: "revoked",
      byOperator,
    });

    await this.broadcast(
      {
        type: "authority_revoked",
        trainId: target.trainId ?? null,
        segment: target.segment ?? null,
      },
      session.id,
    );
  }

  /** Emergency Stop All: revoke every train's authority, broadcast E-stop (spec §3.2). */
  async emergencyStop(byOperator: string | null) {
    const session = await this.getActiveSession();
    if (!session) throw new Error("no active session");

    await db
      .update(trainStatuses)
      .set({ hasAuthority: false, updatedAt: new Date() })
      .where(eq(trainStatuses.sessionId, session.id));
    await db.insert(authorityLog).values({
      sessionId: session.id,
      action: "revoked",
      segment: "ALL",
      byOperator,
    });

    await this.broadcast({ type: "emergency_stop" }, session.id);
  }

  // ---- Session lifecycle (archive / list / reactivate) -------------------

  /** All sessions, newest first (Admin management view). */
  async listSessions() {
    return db.select().from(sessions).orderBy(desc(sessions.createdAt));
  }

  /**
   * Archive the active session without starting a new one (spec §3.3). Returns
   * the archived session, or null if there was nothing active to archive.
   */
  async archiveActiveSession(byOperator: string | null): Promise<typeof sessions.$inferSelect | null> {
    const session = await this.getActiveSession();
    if (!session) return null;

    const [archived] = await db
      .update(sessions)
      .set({ status: "archived" })
      .where(eq(sessions.id, session.id))
      .returning();

    await this.broadcast(
      { type: "session_archived", sessionId: session.id },
      session.id,
    );
    void byOperator; // reserved for future audit attribution
    return archived;
  }

  /**
   * Reactivate an archived session, restoring it as the singleton active one.
   * Refuses if another session is already active (the one-active invariant).
   */
  async reactivateSession(id: string): Promise<typeof sessions.$inferSelect> {
    const active = await this.getActiveSession();
    if (active && active.id !== id) {
      throw new Error("another session is already active — archive it first");
    }

    const [row] = await db
      .update(sessions)
      .set({ status: "active" })
      .where(eq(sessions.id, id))
      .returning();
    if (!row) throw new Error("session not found");

    await this.broadcast({ type: "session_start", sessionId: row.id }, row.id);
    return row;
  }

  /**
   * Permanently delete an archived session and its cascade. Refuses to delete
   * the active session — archive it first.
   */
  async deleteSession(id: string): Promise<"deleted" | "not_found" | "active"> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!row) return "not_found";
    if (row.status === "active") return "active";

    await db.delete(sessions).where(eq(sessions.id, id));
    return "deleted";
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
