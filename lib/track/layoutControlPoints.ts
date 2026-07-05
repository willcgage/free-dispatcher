/**
 * Layout control points (#138) — enumerate the control points across a layout's
 * imported modules (in module order), and derive Sections from them.
 *
 * A control point (authored per-module in the Module Repository) is an
 * interlocking. Assigning each to a District makes it a dispatcher's territory;
 * a Section is then the mainline between two adjacent control points that belong
 * to the same district. Pure so it can be unit-tested.
 *
 * Beyond the module-authored ones, the Layout Builder can place additional
 * layout-level control points (#144) — anchored to a module placement at an
 * offset in inches from its A end — for boundaries the modules don't provide
 * (a CP-less module, a junction between towns). They interleave positionally
 * with the imported ones and feed the same Section derivation.
 */
import { asModuleSchematic } from "./moduleSchematic";
import type { SchematicControlPoint, ModuleSchematicDoc } from "./moduleSchematic";

export interface CpModuleInput {
  /** layout_modules row id — the anchor for layout-level control points. */
  id?: string | null;
  moduleId?: string | null;
  moduleName?: string | null;
  positionIndex?: number;
  schematic?: unknown;
}

/** A layout-level control point stored on layouts.layout_control_points. */
export interface LayoutCp {
  id: string;
  name: string;
  /** layout_modules row id the point is anchored to. */
  anchor: string;
  /** Inches from the anchored module's A end. */
  offsetInches: number;
}

export interface ControlPointRef {
  /** Stable key within the layout: "<moduleRecordNumber>:<cpId>" for imported
   * points, "layout:<id>" for layout-level ones. */
  key: string;
  moduleId: string;
  moduleName: string | null;
  cpId: string;
  name: string;
  source: "module" | "layout";
  /** Inches from the module's A end, when the schematic positions it. */
  posInches: number | null;
}

/** A module CP's representative position: its westmost signal or turnout. */
function cpPosInches(
  cp: SchematicControlPoint,
  doc: ModuleSchematicDoc,
): number | null {
  const positions: number[] = [];
  for (const s of cp.signals ?? []) positions.push(s.pos);
  for (const tid of cp.turnouts ?? []) {
    const t = (doc.turnouts ?? []).find((x) => x.id === tid);
    if (t) positions.push(t.pos);
  }
  return positions.length ? Math.min(...positions) : null;
}

/**
 * Control points across the layout, in running order: modules in spine order,
 * points within a module by position (doc order when unpositioned). Layout-level
 * points interleave by their anchored offset.
 */
export function layoutControlPoints(
  modules: CpModuleInput[],
  layoutCps: LayoutCp[] = [],
): ControlPointRef[] {
  const ordered = [...modules].sort(
    (a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0),
  );
  const out: ControlPointRef[] = [];
  for (const m of ordered) {
    const moduleId = m.moduleId;
    if (!moduleId) continue;
    const doc = asModuleSchematic(m.schematic);
    const refs: ControlPointRef[] = [];
    let docIndex = 0;
    for (const cp of doc?.controlPoints ?? []) {
      if (!cp.id) continue;
      refs.push({
        key: `${moduleId}:${cp.id}`,
        moduleId,
        moduleName: m.moduleName ?? null,
        cpId: cp.id,
        name: cp.name?.trim() || cp.id,
        source: "module",
        posInches: cpPosInches(cp, doc!) ?? docIndex,
      });
      docIndex += 1;
    }
    for (const lc of layoutCps) {
      if (lc.anchor !== (m.id ?? "")) continue;
      refs.push({
        key: `layout:${lc.id}`,
        moduleId,
        moduleName: m.moduleName ?? null,
        cpId: lc.id,
        name: lc.name?.trim() || lc.id,
        source: "layout",
        posInches: lc.offsetInches,
      });
    }
    refs.sort((a, b) => (a.posInches ?? 0) - (b.posInches ?? 0));
    out.push(...refs);
  }
  return out;
}

export interface DerivedSection {
  districtId: string;
  fromKey: string;
  toKey: string;
  name: string;
}

/**
 * Sections between adjacent control points that share a district. The stretch of
 * mainline between two consecutive control points belongs to a district only
 * when both endpoints are assigned to it.
 */
export function deriveSections(
  controlPoints: ControlPointRef[],
  assignments: Record<string, string | undefined>,
): DerivedSection[] {
  const out: DerivedSection[] = [];
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const a = controlPoints[i];
    const b = controlPoints[i + 1];
    const da = assignments[a.key];
    const db = assignments[b.key];
    if (da && da === db) {
      out.push({
        districtId: da,
        fromKey: a.key,
        toKey: b.key,
        name: `${a.name} – ${b.name}`,
      });
    }
  }
  return out;
}

// ---- Materializing derived sections as rows (#146) -------------------------

/** The identity a derived section row carries in sections.derived_key. */
export function derivedSectionKey(s: DerivedSection): string {
  return `${s.fromKey}→${s.toKey}`;
}

/** Derived rows sort after any hand-authored sections in a district. */
export const DERIVED_POSITION_BASE = 1000;

export interface ExistingSectionRow {
  id: string;
  districtId: string;
  name: string;
  position: number;
  derivedKey: string | null;
}

export interface SectionSyncPlan {
  insert: { districtId: string; name: string; position: number; derivedKey: string }[];
  update: { id: string; districtId: string; name: string; position: number }[];
  remove: string[]; // section row ids
}

/**
 * Diff the currently materialized derived sections against what the control
 * points now derive. Hand-authored rows (derivedKey null) are never touched;
 * derived rows are inserted, renamed/moved, or removed to match. Pure so it can
 * be unit-tested; the TrackModel applies the plan transactionally.
 */
export function planSectionSync(
  existing: ExistingSectionRow[],
  derived: DerivedSection[],
  validDistrictIds: Set<string>,
): SectionSyncPlan {
  const desired = new Map<
    string,
    { districtId: string; name: string; position: number }
  >();
  derived.forEach((s, i) => {
    if (!validDistrictIds.has(s.districtId)) return;
    desired.set(derivedSectionKey(s), {
      districtId: s.districtId,
      name: s.name,
      position: DERIVED_POSITION_BASE + i,
    });
  });

  const plan: SectionSyncPlan = { insert: [], update: [], remove: [] };
  const seen = new Set<string>();
  for (const row of existing) {
    if (row.derivedKey == null) continue; // hand-authored — leave alone
    const want = desired.get(row.derivedKey);
    if (!want || seen.has(row.derivedKey)) {
      plan.remove.push(row.id);
      continue;
    }
    seen.add(row.derivedKey);
    if (
      want.districtId !== row.districtId ||
      want.name !== row.name ||
      want.position !== row.position
    ) {
      plan.update.push({ id: row.id, ...want });
    }
  }
  for (const [key, want] of desired) {
    if (!seen.has(key)) plan.insert.push({ ...want, derivedKey: key });
  }
  return plan;
}

/** Parse a jsonb value into layout-level control points, tolerating junk. */
export function asLayoutCps(x: unknown): LayoutCp[] {
  if (!Array.isArray(x)) return [];
  const out: LayoutCp[] = [];
  for (const v of x) {
    if (!v || typeof v !== "object") continue;
    const c = v as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.anchor !== "string") continue;
    out.push({
      id: c.id,
      name: typeof c.name === "string" ? c.name : c.id,
      anchor: c.anchor,
      offsetInches: typeof c.offsetInches === "number" ? c.offsetInches : 0,
    });
  }
  return out;
}
