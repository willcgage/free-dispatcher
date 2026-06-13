/**
 * Free Dispatcher v2 — database schema (Drizzle, Postgres dialect).
 *
 * Ported from System Requirements v2 §9. Runs on embedded PGlite locally
 * (Postgres semantics, incl. jsonb) and is driver-swappable to a real
 * Postgres instance without schema changes.
 *
 * Status/role/enum-like columns are plain text with TS union types declared
 * alongside, rather than pg enums, to keep PGlite migrations simple.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Helper: partial-index predicate `status = 'active'` for the singleton rule.
function sqlActive(col: AnyPgColumn) {
  return sql`${col} = 'active'`;
}

// ---- Enum-like value unions (enforced in app layer) ----------------------
export type SessionStatus = "active" | "archived";
export type DccType = "short" | "long";
export type EquipmentType = "steam" | "diesel" | "passenger" | "freight";
export type TrainStatus = "running" | "holding" | "yard" | "staging";
export type AuthorityAction = "granted" | "revoked";
export type OperatorRole = "admin" | "dispatcher" | "engineer" | "yardmaster";
export type StagingEnd = "A" | "B";

// ---- sessions ------------------------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    date: text("date"), // event date (ISO yyyy-mm-dd)
    venue: text("venue"),
    layoutConfigId: text("layout_config_id"),
    status: text("status").$type<SessionStatus>().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Only one session may be active at a time (spec §3.3 singleton).
    uniqueIndex("sessions_one_active")
      .on(t.status)
      .where(sqlActive(t.status)),
  ],
);

// ---- trains --------------------------------------------------------------
export const trains = pgTable(
  "trains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    name: text("name"),
    dccAddress: integer("dcc_address"),
    dccType: text("dcc_type").$type<DccType>(),
    owner: text("owner"),
    consistId: text("consist_id"),
    equipmentType: text("equipment_type").$type<EquipmentType>(),
    // Engineer assigned to this train for the session (spec §3.3). Set in the
    // Admin roster or auto-set by the WiThrottle monitor on loco acquisition.
    assignedOperatorId: uuid("assigned_operator_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trains_session_idx").on(t.sessionId),
    index("trains_assigned_idx").on(t.assignedOperatorId),
  ],
);

// ---- train_statuses ------------------------------------------------------
export const trainStatuses = pgTable(
  "train_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainId: uuid("train_id")
      .notNull()
      .references(() => trains.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    status: text("status").$type<TrainStatus>().notNull().default("yard"),
    locationName: text("location_name"),
    hasAuthority: boolean("has_authority").notNull().default(false),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("train_statuses_train_idx").on(t.trainId),
    index("train_statuses_session_idx").on(t.sessionId),
  ],
);

// ---- authority_log -------------------------------------------------------
export const authorityLog = pgTable(
  "authority_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    trainId: uuid("train_id").references(() => trains.id, {
      onDelete: "set null",
    }),
    segment: text("segment"),
    action: text("action").$type<AuthorityAction>().notNull(),
    byOperator: text("by_operator"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("authority_log_session_idx").on(t.sessionId)],
);

// ---- operators -----------------------------------------------------------
export const operators = pgTable(
  "operators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").$type<OperatorRole>().notNull(),
    deviceId: text("device_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    index("operators_session_idx").on(t.sessionId),
    index("operators_device_idx").on(t.deviceId),
  ],
);

// ---- ops_log -------------------------------------------------------------
export const opsLog = pgTable(
  "ops_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ops_log_session_idx").on(t.sessionId)],
);

// ---- module_layouts ------------------------------------------------------
// module_id references the locally-synced Module Repository catalog (carried
// forward from the M6 work). Kept as text to match the repo's record number.
export const moduleLayouts = pgTable(
  "module_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    positionIndex: integer("position_index").notNull().default(0),
    stagingEnd: text("staging_end").$type<StagingEnd>(),
  },
  (t) => [index("module_layouts_session_idx").on(t.sessionId)],
);

// ---- staging_tracks ------------------------------------------------------
export const stagingTracks = pgTable(
  "staging_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layoutId: uuid("layout_id")
      .notNull()
      .references(() => moduleLayouts.id, { onDelete: "cascade" }),
    end: text("end").$type<StagingEnd>().notNull(),
    trackName: text("track_name").notNull(),
    assignedTrainId: uuid("assigned_train_id").references(() => trains.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("staging_tracks_layout_idx").on(t.layoutId)],
);

// ---- app_settings --------------------------------------------------------
// Singleton-ish key/value store for Admin configuration (WiThrottle, server).
// Not in spec §9 but required by the §3.3 settings screens; persisted
// so all clients load it on connect.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const schema = {
  sessions,
  trains,
  trainStatuses,
  authorityLog,
  operators,
  opsLog,
  moduleLayouts,
  stagingTracks,
  appSettings,
};
