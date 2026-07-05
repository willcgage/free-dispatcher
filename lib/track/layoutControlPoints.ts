/**
 * Layout control points (#138) — enumerate the control points across a layout's
 * imported modules (in module order), and derive Sections from them.
 *
 * A control point (authored per-module in the Module Repository) is an
 * interlocking. Assigning each to a District makes it a dispatcher's territory;
 * a Section is then the mainline between two adjacent control points that belong
 * to the same district. Pure so it can be unit-tested.
 */
import { asModuleSchematic } from "./moduleSchematic";

export interface CpModuleInput {
  moduleId?: string | null;
  moduleName?: string | null;
  positionIndex?: number;
  schematic?: unknown;
}

export interface ControlPointRef {
  /** Stable key within the layout: "<moduleRecordNumber>:<cpId>". */
  key: string;
  moduleId: string;
  moduleName: string | null;
  cpId: string;
  name: string;
}

/** Control points across the layout's modules, in module (spine) order. */
export function layoutControlPoints(
  modules: CpModuleInput[],
): ControlPointRef[] {
  const ordered = [...modules].sort(
    (a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0),
  );
  const out: ControlPointRef[] = [];
  for (const m of ordered) {
    const moduleId = m.moduleId;
    if (!moduleId) continue;
    const doc = asModuleSchematic(m.schematic);
    for (const cp of doc?.controlPoints ?? []) {
      if (!cp.id) continue;
      out.push({
        key: `${moduleId}:${cp.id}`,
        moduleId,
        moduleName: m.moduleName ?? null,
        cpId: cp.id,
        name: cp.name?.trim() || cp.id,
      });
    }
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
