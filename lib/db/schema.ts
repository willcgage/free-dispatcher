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
  real,
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
// Direction a Section is allocated in, along its own block order (end A → end B
// or reverse). Set per allocation (#80) so single-track sections work both ways
// for meets and double-track mains carry parallel chains.
export type SectionDirection = "AtoB" | "BtoA";
// Virtual turnout state (#83) — normal (straight/main) or reversed (diverging).
export type TurnoutPosition = "normal" | "reversed";

// ---- layouts -------------------------------------------------------------
// A layout is the reusable, static definition of a physical layout: its track
// model (districts → sections → blocks) lives here and is authored once, then a
// session runs *on* a layout (#80). Runtime state (occupancy, allocations) is
// session-scoped, not here. Folding module_layouts under a layout is #84.
export const layouts = pgTable("layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  // The modular standard this layout is built to (Module Repository is
  // multi-standard). Its module catalog is filtered to this value (#123).
  // Stored as the standard's `value` slug (e.g. "freemon", "ttrak").
  standard: text("standard").notNull().default("freemon"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- sessions ------------------------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    date: text("date"), // event date (ISO yyyy-mm-dd)
    venue: text("venue"),
    // The layout this session runs on (its track model). Nullable so existing
    // sessions and the legacy module-only flow keep working (#84 consolidates).
    layoutId: uuid("layout_id").references(() => layouts.id, {
      onDelete: "set null",
    }),
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
// The ordered module sequence that makes up a LAYOUT (#84): a layout owns its
// modules, and a session runs on the layout. module_id references the
// locally-synced Module Repository catalog; kept as text to match its record #.
export const moduleLayouts = pgTable(
  "module_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layoutId: uuid("layout_id")
      .notNull()
      .references(() => layouts.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    positionIndex: integer("position_index").notNull().default(0),
    stagingEnd: text("staging_end").$type<StagingEnd>(),
    // Mirror this placement so curves bend the other way (#115 orientation).
    flipped: boolean("flipped").notNull().default(false),
  },
  (t) => [index("module_layouts_layout_idx").on(t.layoutId)],
);

// ---- repo_modules --------------------------------------------------------
// Local cache of the Module Repository catalog, synced via GET /api/v1/modules/full
// (ADR-001: read-only, one-directional). Nested endplates/tracks/industries
// stored as jsonb to avoid join tables for read-only upstream data.
export const repoModules = pgTable("repo_modules", {
  recordNumber: text("record_number").primaryKey(), // e.g. "FMN-0001"
  moduleName: text("module_name").notNull(),
  // Standard slug derived upstream from the record prefix (#123): FMN→freemon,
  // TTK→ttrak, … Null for legacy rows synced before the column existed.
  standard: text("standard"),
  owner: text("owner"),
  description: text("description"),
  category: text("category"),
  geometryType: text("geometry_type"),
  geometryDegrees: real("geometry_degrees"),
  geometryOffsetInches: real("geometry_offset_inches"),
  lengthTotalInches: real("length_total_inches"),
  mainlineLengthInches: real("mainline_length_inches"),
  endplateCount: integer("endplate_count"),
  hasMss: boolean("has_mss"),
  mssType: text("mss_type"),
  status: text("status"),
  endplates: jsonb("endplates"),
  tracks: jsonb("tracks"),
  industries: jsonb("industries"),
  // Owner-uploaded schematic files (module outline / track plan). Metadata only
  // (storage_path, file_name, file_format); the private file is fetched via a
  // signed URL on demand (#122).
  schematics: jsonb("schematics"),
  // Owner-authored structured track-graph (#122) — the module's schematic doc
  // (endplates/tracks/turnouts/signals) FD composes into a layout. See
  // docs/module-schematic-format.md. Null for un-authored modules.
  schematic: jsonb("schematic"),
  upstreamUpdatedAt: timestamp("upstream_updated_at", { withTimezone: true }),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

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

// ==== Track model (#80) ===================================================
// Static, layout-scoped hierarchy: District → Section → Block (largest → holds
// smallest). Authored once per layout and reused across sessions.

// ---- districts -----------------------------------------------------------
// A dispatcher's territory: a group of Sections. Dispatcher assignment is a
// per-session concern (operators are session-scoped) handled in #76/#85.
export const districts = pgTable(
  "districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layoutId: uuid("layout_id")
      .notNull()
      .references(() => layouts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("districts_layout_idx").on(t.layoutId)],
);

// ---- sections ------------------------------------------------------------
// The unit a dispatcher allocates: an ordered group of connected Blocks within
// one District. `track` optionally names a parallel main (e.g. "Main 1") for
// double-track; direction is chosen per allocation, not stored here.
export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => districts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    track: text("track"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sections_district_idx").on(t.districtId)],
);

// ---- blocks --------------------------------------------------------------
// Smallest unit; occupancy is marked per Block. Authored explicitly and ordered
// within its Section; `moduleRecordNumber` optionally maps it to a Free-moN
// module (repo_modules) for display — kept as loose text, not an FK, since the
// module cache is volatile (#80 decision: authored, optional module link).
export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    moduleRecordNumber: text("module_record_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("blocks_section_idx").on(t.sectionId)],
);

// ==== Track runtime state (session-scoped) ================================

// ---- block_occupancy -----------------------------------------------------
// This session's live occupancy of a Block (manually marked in v1). One row per
// (session, block); `trainId` optionally records who occupies it.
export const blockOccupancy = pgTable(
  "block_occupancy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    blockId: uuid("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    occupied: boolean("occupied").notNull().default(false),
    trainId: uuid("train_id").references(() => trains.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("block_occupancy_session_block").on(t.sessionId, t.blockId),
    index("block_occupancy_session_idx").on(t.sessionId),
  ],
);

// ---- section_allocations -------------------------------------------------
// A Section granted to a train for this session, in a direction. A train may
// hold several (a route); all must share a District (enforced in the app). The
// partial unique index guarantees at most one *active* allocation per Section
// per session — the DB-level backstop for conflicting authority (#90).
export const sectionAllocations = pgTable(
  "section_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    trainId: uuid("train_id")
      .notNull()
      .references(() => trains.id, { onDelete: "cascade" }),
    direction: text("direction").$type<SectionDirection>().notNull(),
    active: boolean("active").notNull().default(true),
    allocatedBy: text("allocated_by"),
    allocatedAt: timestamp("allocated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => [
    index("section_allocations_session_idx").on(t.sessionId),
    index("section_allocations_train_idx").on(t.trainId),
    uniqueIndex("section_allocations_active_section")
      .on(t.sessionId, t.sectionId)
      .where(sql`${t.active}`),
  ],
);

// ---- turnouts ------------------------------------------------------------
// Static, layout-scoped turnouts within a District (#83). The switch position
// itself is per-session runtime state (turnout_positions), like block occupancy.
export const turnouts = pgTable(
  "turnouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => districts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("turnouts_district_idx").on(t.districtId)],
);

// ---- turnout_positions ---------------------------------------------------
// This session's live position of a turnout (manual in v1). One row per
// (session, turnout).
export const turnoutPositions = pgTable(
  "turnout_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    turnoutId: uuid("turnout_id")
      .notNull()
      .references(() => turnouts.id, { onDelete: "cascade" }),
    position: text("position")
      .$type<TurnoutPosition>()
      .notNull()
      .default("normal"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("turnout_positions_session_turnout").on(
      t.sessionId,
      t.turnoutId,
    ),
    index("turnout_positions_session_idx").on(t.sessionId),
  ],
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
  layouts,
  sessions,
  trains,
  trainStatuses,
  authorityLog,
  operators,
  opsLog,
  moduleLayouts,
  stagingTracks,
  districts,
  sections,
  blocks,
  blockOccupancy,
  sectionAllocations,
  turnouts,
  turnoutPositions,
  appSettings,
  repoModules,
};
