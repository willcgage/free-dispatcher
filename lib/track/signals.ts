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
