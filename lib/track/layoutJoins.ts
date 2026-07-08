/**
 * Layout joins (#175 phase 2) — endplate-to-endplate connections between module
 * placements. Every endplate is the same standard Free-moN interface, so a join
 * is just a pair of endplate refs; the footprint solver (phase 3) walks them.
 *
 * The chain + branch spines GENERATE joins implicitly (consecutive modules mate
 * B→A; a branch's first module mates the junction endplate). Those are derived,
 * never stored. Explicit joins — stored on layouts.branches' sibling
 * layouts.joins — add what the spine can't imply: closing a circuit (last
 * module's endplate back to the first), connecting a loop module's second
 * endplate, or any endplate-to-any-endplate cross-connection.
 *
 * Pure so it can be unit-tested; TrackModel assembles the inputs.
 */
import { asModuleSchematic } from "./moduleSchematic";

export interface EndplateRef {
  /** layout_modules row id. */
  placementId: string;
  /** Endplate id on that module ("A", "B", "C"…). */
  endplateId: string;
}
export interface LayoutJoin {
  id: string;
  a: EndplateRef;
  b: EndplateRef;
  /** True when derived from the spine order (not user-stored). */
  implicit?: boolean;
}

export interface JoinPlacement {
  /** layout_modules row id. */
  id: string;
  moduleId?: string | null;
  moduleName?: string | null;
  positionIndex?: number;
  schematic?: unknown;
}
export interface JoinSpine {
  /** null = main spine, otherwise a branch id. */
  branchId: string | null;
  /** Where a branch attaches: a placement + endplate on another spine. */
  origin?: { placementId: string; endplateId: string };
  modules: JoinPlacement[];
}

/** Endplate ids a placement exposes — from its schematic doc, or A/B by default
 * (a loop module exposes just A, or A+B for an interchange loop). */
export function moduleEndplates(m: JoinPlacement): string[] {
  const doc = asModuleSchematic(m.schematic);
  const ids = (doc?.endplates ?? [])
    .map((e) => e.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length ? ids : ["A", "B"];
}

const refKey = (r: EndplateRef) => `${r.placementId}:${r.endplateId}`;
/** Order-independent identity of a join (endplate pair). */
export function joinKey(j: { a: EndplateRef; b: EndplateRef }): string {
  return [refKey(j.a), refKey(j.b)].sort().join("|");
}

/**
 * Joins implied by the spine graph: consecutive modules on a spine mate B→A,
 * and a branch's first module mates the junction endplate it originates from.
 */
export function implicitJoins(spines: JoinSpine[]): LayoutJoin[] {
  const out: LayoutJoin[] = [];
  for (const s of spines) {
    const ordered = [...s.modules].sort(
      (a, b) => (a.positionIndex ?? 0) - (b.positionIndex ?? 0),
    );
    // Branch attaches at its origin endplate ↔ the branch's first module's A.
    if (s.origin && ordered[0]) {
      out.push({
        id: `imp:${s.origin.placementId}:${s.origin.endplateId}-${ordered[0].id}:A`,
        a: { placementId: s.origin.placementId, endplateId: s.origin.endplateId },
        b: { placementId: ordered[0].id, endplateId: "A" },
        implicit: true,
      });
    }
    for (let i = 0; i < ordered.length - 1; i++) {
      out.push({
        id: `imp:${ordered[i].id}:B-${ordered[i + 1].id}:A`,
        a: { placementId: ordered[i].id, endplateId: "B" },
        b: { placementId: ordered[i + 1].id, endplateId: "A" },
        implicit: true,
      });
    }
  }
  return out;
}

/**
 * Every join in the layout: the implicit spine joins plus the stored explicit
 * ones, de-duplicated by endplate pair (implicit wins). Explicit joins that
 * merely restate an implied connection are dropped.
 */
export function layoutJoins(
  spines: JoinSpine[],
  stored: LayoutJoin[] = [],
): LayoutJoin[] {
  const implicit = implicitJoins(spines);
  const seen = new Set(implicit.map(joinKey));
  const out = [...implicit];
  for (const j of stored) {
    const k = joinKey(j);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...j, implicit: false });
  }
  return out;
}

export type JoinStatus = "ok" | "mismatch" | "unknown" | "dangling";

/**
 * Endplate track config (single/double) for a ref, from the module's schematic
 * doc — used for join compatibility. Null when unknown.
 */
export function endplateConfig(
  m: JoinPlacement | undefined,
  endplateId: string,
): "single" | "double" | null {
  if (!m) return null;
  const doc = asModuleSchematic(m.schematic);
  const ep = (doc?.endplates ?? []).find((e) => e.id === endplateId);
  const cfg = ep?.tracks?.[0]?.config;
  return cfg === "double" ? "double" : cfg === "single" ? "single" : null;
}

/** Per-join compatibility: both endplates must exist and share a track config. */
export function joinStatus(
  join: { a: EndplateRef; b: EndplateRef },
  byId: Map<string, JoinPlacement>,
): JoinStatus {
  const ma = byId.get(join.a.placementId);
  const mb = byId.get(join.b.placementId);
  if (!ma || !mb) return "dangling";
  if (
    !moduleEndplates(ma).includes(join.a.endplateId) ||
    !moduleEndplates(mb).includes(join.b.endplateId)
  ) {
    return "dangling";
  }
  const ca = endplateConfig(ma, join.a.endplateId);
  const cb = endplateConfig(mb, join.b.endplateId);
  if (ca == null || cb == null) return "unknown";
  return ca === cb ? "ok" : "mismatch";
}

/** Parse a jsonb value into stored joins, tolerating junk. */
export function asJoins(x: unknown): LayoutJoin[] {
  if (!Array.isArray(x)) return [];
  const out: LayoutJoin[] = [];
  const ref = (v: unknown): EndplateRef | null => {
    if (!v || typeof v !== "object") return null;
    const r = v as Record<string, unknown>;
    if (typeof r.placementId !== "string" || typeof r.endplateId !== "string")
      return null;
    return { placementId: r.placementId, endplateId: r.endplateId };
  };
  for (const v of x) {
    if (!v || typeof v !== "object") continue;
    const j = v as Record<string, unknown>;
    const a = ref(j.a);
    const b = ref(j.b);
    if (!a || !b) continue;
    out.push({ id: typeof j.id === "string" ? j.id : joinKey({ a, b }), a, b });
  }
  return out;
}
