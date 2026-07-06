/**
 * Virtual signals (#83) — simple APB-style indications derived from track state.
 *
 * v1 signals are computed, not stored: a Section's aspect follows its occupancy
 * and allocation (no JMRI/LCC hardware; that's the later #55 layer). Pure so it
 * unit-tests without a database.
 *
 *   occupied  — a Block in the Section is occupied (a train is there)  → Stop
 *   allocated — held by a train but not yet occupied (authority granted) → protected
 *   clear     — free and unallocated → available
 */

import type { ControlPointRef } from "./layoutControlPoints";

export type SignalAspect = "clear" | "allocated" | "occupied";

/** Derive a Section's aspect from its blocks' occupancy and whether it's held. */
export function deriveSectionAspect(
  blockIds: string[],
  occupiedBlockIds: ReadonlySet<string>,
  isAllocated: boolean,
): SignalAspect {
  if (blockIds.some((id) => occupiedBlockIds.has(id))) return "occupied";
  if (isAllocated) return "allocated";
  return "clear";
}

export interface AspectMeta {
  label: string;
  /** Tailwind class for the signal dot. */
  dot: string;
  /** Tailwind class for accompanying text. */
  text: string;
}

export const ASPECT_META: Record<SignalAspect, AspectMeta> = {
  clear: { label: "Clear", dot: "bg-emerald-500", text: "text-emerald-300" },
  allocated: { label: "Allocated", dot: "bg-amber-400", text: "text-amber-300" },
  occupied: { label: "Occupied", dot: "bg-red-500", text: "text-red-300" },
};

export const ASPECT_ORDER: SignalAspect[] = ["clear", "allocated", "occupied"];

// ---- Control-point signal aspects (#151) -----------------------------------

/** A control-point signal is absolute: red until a route is cleared past it. */
export type CpSignalAspect = "clear" | "stop";

export interface CpAspects {
  AtoB: CpSignalAspect;
  BtoA: CpSignalAspect;
}

/**
 * Direction-aware aspects for every control point on the panel (CTC-style):
 * the signal at a section's entrance clears only when that section is allocated
 * in the signal's facing direction and nothing occupies it; everything else —
 * unallocated, opposing movement, occupied — reads stop.
 *
 * Keyed by the control point's layout key ("<moduleRecordNumber>:<cpId>" /
 * "layout:<id>"). Pure so it unit-tests without a database.
 */
export function cpSignalAspects(
  controlPoints: ControlPointRef[],
  sectionsByDerivedKey: ReadonlyMap<string, string>, // derivedKey → sectionId
  allocations: Readonly<Record<string, { direction: "AtoB" | "BtoA" }>>,
  occupiedSectionIds: ReadonlySet<string>,
): Record<string, CpAspects> {
  const out: Record<string, CpAspects> = {};
  for (const cp of controlPoints) out[cp.key] = { AtoB: "stop", BtoA: "stop" };
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const a = controlPoints[i];
    const b = controlPoints[i + 1];
    // Per-spine adjacency (#170): no section spans a junction.
    if ((a.spineId ?? null) !== (b.spineId ?? null)) continue;
    const sectionId = sectionsByDerivedKey.get(`${a.key}→${b.key}`);
    if (!sectionId) continue;
    const alloc = allocations[sectionId];
    if (!alloc || occupiedSectionIds.has(sectionId)) continue;
    // Entering the section eastward past A, or westward past B.
    if (alloc.direction === "AtoB") out[a.key].AtoB = "clear";
    else out[b.key].BtoA = "clear";
  }
  return out;
}
