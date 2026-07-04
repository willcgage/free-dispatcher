/**
 * TrackModel (#80) — the track model service.
 *
 * Two concerns:
 *  - **Authoring** the static, layout-scoped hierarchy District → Section →
 *    Block (created once per layout, reused across sessions).
 *  - **Runtime** state for the active session: manual Block occupancy and
 *    Section allocation to trains (with a direction), released via a flag.
 *
 * Runtime mutations broadcast an FdEvent + persist to ops_log through the
 * SessionManager, mirroring how authority changes work. Conflicting allocation
 * is caught at the DB level by a partial unique index (one active allocation per
 * section per session); an allocation route must also stay within one District.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  layouts,
  districts,
  sections,
  blocks,
  blockOccupancy,
  sectionAllocations,
  turnouts,
  turnoutPositions,
  moduleLayouts,
  repoModules,
  type SectionDirection,
  type TurnoutPosition,
  type StagingEnd,
} from "@/lib/db/schema";
import { sessionManager } from "./SessionManager";

// ---- Authoring input/output shapes ---------------------------------------

export interface BlockInput {
  name: string;
  position?: number;
  moduleRecordNumber?: string | null;
}
export interface SectionInput {
  name: string;
  track?: string | null;
  position?: number;
  blocks?: BlockInput[];
}
export interface TurnoutInput {
  name: string;
}
export interface DistrictInput {
  name: string;
  position?: number;
  sections?: SectionInput[];
  turnouts?: TurnoutInput[];
}
export interface LayoutInput {
  name: string;
  description?: string | null;
  districts?: DistrictInput[];
}

type BlockRow = typeof blocks.$inferSelect;
type SectionRow = typeof sections.$inferSelect;
type DistrictRow = typeof districts.$inferSelect;
type LayoutRow = typeof layouts.$inferSelect;
type TurnoutRow = typeof turnouts.$inferSelect;

export interface LayoutModule {
  id: string;
  moduleId: string;
  positionIndex: number;
  stagingEnd: StagingEnd | null;
  moduleName: string | null;
  lengthTotalInches: number | null;
  mainlineLengthInches: number | null;
  hasMss: boolean | null;
  geometryType: string | null;
  geometryDegrees: number | null;
  flipped: boolean;
}

export interface LayoutTree extends LayoutRow {
  modules: LayoutModule[];
  districts: (DistrictRow & {
    sections: (SectionRow & { blocks: BlockRow[] })[];
    turnouts: TurnoutRow[];
  })[];
}

// ---- Pure helpers (unit-tested) ------------------------------------------

/**
 * A route allocation must live within a single District (#80). Throws when the
 * given sections span more than one, or when a requested section is missing.
 */
export function assertSingleDistrict(
  found: { id: string; districtId: string }[],
  requestedIds: string[],
): string {
  if (found.length !== requestedIds.length) {
    throw new Error("one or more sections do not exist");
  }
  const districtIds = new Set(found.map((s) => s.districtId));
  if (districtIds.size > 1) {
    throw new Error("all sections in an allocation must be in one district");
  }
  return [...districtIds][0];
}

/** Nest flat district/section/block/turnout rows under a layout into a tree. */
export function buildLayoutTree(
  layout: LayoutRow,
  districtRows: DistrictRow[],
  sectionRows: SectionRow[],
  blockRows: BlockRow[],
  turnoutRows: TurnoutRow[] = [],
  moduleRows: LayoutModule[] = [],
): LayoutTree {
  const byPos = <T extends { position: number }>(a: T, b: T) =>
    a.position - b.position;
  const blocksBySection = new Map<string, BlockRow[]>();
  for (const b of blockRows) {
    const arr = blocksBySection.get(b.sectionId) ?? [];
    arr.push(b);
    blocksBySection.set(b.sectionId, arr);
  }
  const sectionsByDistrict = new Map<string, SectionRow[]>();
  for (const s of sectionRows) {
    const arr = sectionsByDistrict.get(s.districtId) ?? [];
    arr.push(s);
    sectionsByDistrict.set(s.districtId, arr);
  }
  const turnoutsByDistrict = new Map<string, TurnoutRow[]>();
  for (const t of turnoutRows) {
    const arr = turnoutsByDistrict.get(t.districtId) ?? [];
    arr.push(t);
    turnoutsByDistrict.set(t.districtId, arr);
  }
  return {
    ...layout,
    modules: [...moduleRows].sort((a, b) => a.positionIndex - b.positionIndex),
    districts: [...districtRows].sort(byPos).map((d) => ({
      ...d,
      sections: (sectionsByDistrict.get(d.id) ?? []).sort(byPos).map((s) => ({
        ...s,
        blocks: (blocksBySection.get(s.id) ?? []).sort(byPos),
      })),
      turnouts: turnoutsByDistrict.get(d.id) ?? [],
    })),
  };
}

// ---- Service -------------------------------------------------------------

class TrackModel {
  // -- Authoring (static, layout-scoped) --------------------------------

  /** Create a layout and, optionally, its whole District→Section→Block tree. */
  async createLayout(input: LayoutInput): Promise<LayoutTree> {
    const layoutId = await db.transaction(async (tx) => {
      const [layout] = await tx
        .insert(layouts)
        .values({ name: input.name, description: input.description ?? null })
        .returning();

      for (const [di, d] of (input.districts ?? []).entries()) {
        const [district] = await tx
          .insert(districts)
          .values({ layoutId: layout.id, name: d.name, position: d.position ?? di })
          .returning();

        for (const [si, s] of (d.sections ?? []).entries()) {
          const [section] = await tx
            .insert(sections)
            .values({
              districtId: district.id,
              name: s.name,
              track: s.track ?? null,
              position: s.position ?? si,
            })
            .returning();

          if (s.blocks?.length) {
            await tx.insert(blocks).values(
              s.blocks.map((b, bi) => ({
                sectionId: section.id,
                name: b.name,
                position: b.position ?? bi,
                moduleRecordNumber: b.moduleRecordNumber ?? null,
              })),
            );
          }
        }

        if (d.turnouts?.length) {
          await tx.insert(turnouts).values(
            d.turnouts.map((t) => ({ districtId: district.id, name: t.name })),
          );
        }
      }
      return layout.id;
    });

    return this.getLayout(layoutId) as Promise<LayoutTree>;
  }

  /** All layouts, newest first. */
  async listLayouts(): Promise<LayoutRow[]> {
    return db.select().from(layouts);
  }

  /** Full District→Section→Block tree for a layout, or null if missing. */
  async getLayout(layoutId: string): Promise<LayoutTree | null> {
    const [layout] = await db
      .select()
      .from(layouts)
      .where(eq(layouts.id, layoutId))
      .limit(1);
    if (!layout) return null;

    const districtRows = await db
      .select()
      .from(districts)
      .where(eq(districts.layoutId, layoutId));
    const districtIds = districtRows.map((d) => d.id);
    const sectionRows = districtIds.length
      ? await db.select().from(sections).where(inArray(sections.districtId, districtIds))
      : [];
    const sectionIds = sectionRows.map((s) => s.id);
    const blockRows = sectionIds.length
      ? await db.select().from(blocks).where(inArray(blocks.sectionId, sectionIds))
      : [];
    const turnoutRows = districtIds.length
      ? await db.select().from(turnouts).where(inArray(turnouts.districtId, districtIds))
      : [];
    const moduleRows = await db
      .select({
        id: moduleLayouts.id,
        moduleId: moduleLayouts.moduleId,
        positionIndex: moduleLayouts.positionIndex,
        stagingEnd: moduleLayouts.stagingEnd,
        flipped: moduleLayouts.flipped,
        moduleName: repoModules.moduleName,
        lengthTotalInches: repoModules.lengthTotalInches,
        mainlineLengthInches: repoModules.mainlineLengthInches,
        hasMss: repoModules.hasMss,
        geometryType: repoModules.geometryType,
        geometryDegrees: repoModules.geometryDegrees,
      })
      .from(moduleLayouts)
      .leftJoin(repoModules, eq(moduleLayouts.moduleId, repoModules.recordNumber))
      .where(eq(moduleLayouts.layoutId, layoutId))
      .orderBy(asc(moduleLayouts.positionIndex));

    return buildLayoutTree(
      layout,
      districtRows,
      sectionRows,
      blockRows,
      turnoutRows,
      moduleRows,
    );
  }

  // -- Runtime (active-session-scoped) ----------------------------------

  /** Mark/clear a Block's occupancy for the active session (upsert). */
  async setBlockOccupancy(
    blockId: string,
    occupied: boolean,
    trainId: string | null,
    updatedBy: string | null,
  ) {
    const session = await sessionManager.getActiveSession();
    if (!session) throw new Error("no active session");

    const [row] = await db
      .insert(blockOccupancy)
      .values({ sessionId: session.id, blockId, occupied, trainId, updatedBy })
      .onConflictDoUpdate({
        target: [blockOccupancy.sessionId, blockOccupancy.blockId],
        set: { occupied, trainId, updatedBy, updatedAt: new Date() },
      })
      .returning();

    await sessionManager.broadcast(
      { type: "block_occupancy_changed", blockId, occupied, trainId },
      session.id,
    );
    return row;
  }

  /** Set a turnout's position for the active session (upsert). */
  async setTurnoutPosition(
    turnoutId: string,
    position: TurnoutPosition,
    updatedBy: string | null,
  ) {
    const session = await sessionManager.getActiveSession();
    if (!session) throw new Error("no active session");

    const [row] = await db
      .insert(turnoutPositions)
      .values({ sessionId: session.id, turnoutId, position, updatedBy })
      .onConflictDoUpdate({
        target: [turnoutPositions.sessionId, turnoutPositions.turnoutId],
        set: { position, updatedBy, updatedAt: new Date() },
      })
      .returning();

    await sessionManager.broadcast(
      { type: "turnout_changed", turnoutId, position },
      session.id,
    );
    return row;
  }

  /**
   * Allocate one or more Sections to a train, in a direction, for the active
   * session. All sections must be in one District. A section already actively
   * allocated is rejected (partial unique index → surfaced as a 409). Atomic:
   * if any section conflicts, none are allocated.
   */
  async allocateSections(
    sectionIds: string[],
    trainId: string,
    direction: SectionDirection,
    byOperator: string | null,
  ) {
    if (sectionIds.length === 0) throw new Error("no sections to allocate");
    const session = await sessionManager.getActiveSession();
    if (!session) throw new Error("no active session");

    const found = await db
      .select({ id: sections.id, districtId: sections.districtId })
      .from(sections)
      .where(inArray(sections.id, sectionIds));
    assertSingleDistrict(found, sectionIds);

    let allocated;
    try {
      allocated = await db.transaction(async (tx) =>
        tx
          .insert(sectionAllocations)
          .values(
            sectionIds.map((sectionId) => ({
              sessionId: session.id,
              sectionId,
              trainId,
              direction,
              allocatedBy: byOperator,
            })),
          )
          .returning(),
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("a section is already allocated to another train");
      }
      throw err;
    }

    for (const a of allocated) {
      await sessionManager.broadcast(
        {
          type: "section_allocated",
          allocationId: a.id,
          sectionId: a.sectionId,
          trainId: a.trainId,
          direction: a.direction as SectionDirection,
        },
        session.id,
      );
    }
    return allocated;
  }

  /** Release every active allocation of a Section for the active session. */
  async releaseSection(sectionId: string, byOperator: string | null) {
    const session = await sessionManager.getActiveSession();
    if (!session) throw new Error("no active session");

    const released = await db
      .update(sectionAllocations)
      .set({ active: false, releasedAt: new Date(), allocatedBy: byOperator })
      .where(
        and(
          eq(sectionAllocations.sessionId, session.id),
          eq(sectionAllocations.sectionId, sectionId),
          eq(sectionAllocations.active, true),
        ),
      )
      .returning();

    for (const a of released) {
      await sessionManager.broadcast(
        {
          type: "section_released",
          allocationId: a.id,
          sectionId: a.sectionId,
          trainId: a.trainId,
        },
        session.id,
      );
    }
    return released;
  }

  /** Live occupancy + active allocations + turnout positions for the session. */
  async getSessionTrackState() {
    const session = await sessionManager.getActiveSession();
    if (!session) return { occupancy: [], allocations: [], turnouts: [] };

    const [occupancy, allocations, turnoutRows] = await Promise.all([
      db.select().from(blockOccupancy).where(eq(blockOccupancy.sessionId, session.id)),
      db
        .select()
        .from(sectionAllocations)
        .where(
          and(
            eq(sectionAllocations.sessionId, session.id),
            eq(sectionAllocations.active, true),
          ),
        ),
      db
        .select()
        .from(turnoutPositions)
        .where(eq(turnoutPositions.sessionId, session.id)),
    ]);
    return { occupancy, allocations, turnouts: turnoutRows };
  }
}

/** Postgres/PGlite unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? "";
  return code === "23505" || /unique|duplicate key/i.test(message);
}

const globalForTm = globalThis as unknown as { __fdTrackModel?: TrackModel };
export const trackModel = globalForTm.__fdTrackModel ?? new TrackModel();
if (process.env.NODE_ENV !== "production") {
  globalForTm.__fdTrackModel = trackModel;
}
