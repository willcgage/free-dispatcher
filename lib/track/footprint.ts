/**
 * Footprint solver (#175 phase 3) — compose a layout's modules into an accurate
 * to-scale 2D map by walking the endplate-join graph and stacking each module's
 * rigid transform.
 *
 * Each module's endplate poses (module-local (x, y, heading) at the track point)
 * come from the shared package's deriveEndplatePoses. A join says two endplates
 * are the same physical point facing opposite ways; that constraint places a
 * neighbour relative to an already-placed module. Cyclic joins (a closed
 * circuit) don't place anything new — the gap between where the two ends land
 * is the closure error, reported so a setup crew can distribute it across joints.
 *
 * Pure so it can be unit-tested; the SVG component just draws the result.
 */
import {
  deriveEndplatePoses,
  type EndplatePose,
} from "@willcgage/module-schematic";
import {
  layoutJoins,
  type JoinSpine,
  type LayoutJoin,
} from "./layoutJoins";
import { asModuleSchematic } from "./moduleSchematic";

export interface Pt {
  x: number;
  y: number;
}

/** A module placement's inputs for the solver. */
export interface FootprintModule {
  /** layout_modules row id. */
  id: string;
  moduleName?: string | null;
  moduleId?: string | null;
  lengthTotalInches?: number | null;
  mainlineLengthInches?: number | null;
  geometryType?: string | null;
  geometryDegrees?: number | null;
  geometryOffsetInches?: number | null;
  /** Mirror the module (reflection) — Free-mo modules are two-sided. */
  mirrored?: boolean;
  /** The schematic doc (for branch endplates + endplate configs). */
  schematic?: unknown;
}

/** A 2D rigid transform: rotate by `rot`° (after an optional Y reflection),
 * then translate. */
interface Transform {
  rot: number;
  tx: number;
  ty: number;
  mirror: boolean;
}

export interface PlacedModule {
  id: string;
  moduleName: string | null;
  /** Endplate world poses (x, y in layout inches, heading = outward normal°). */
  endplates: { id: string; x: number; y: number; heading: number }[];
  /** Module centre-line in world coords (main track A→B). */
  centerline: Pt[];
}

export interface ClosureError {
  joinId: string;
  /** Distance between where the two joined ends actually land (inches). */
  gapInches: number;
  /** How far off the ideal 180° the two outward normals are (degrees). */
  gapDegrees: number;
}

export interface Footprint {
  placed: PlacedModule[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  closures: ClosureError[];
  /** Placement ids the join graph never reached (disconnected). */
  unplaced: string[];
}

const DEG = Math.PI / 180;
const norm180 = (d: number) => {
  let x = ((d + 180) % 360) - 180;
  if (x <= -180) x += 360;
  return x;
};

function applyPoint(t: Transform, p: Pt): Pt {
  const py = t.mirror ? -p.y : p.y;
  const c = Math.cos(t.rot * DEG);
  const s = Math.sin(t.rot * DEG);
  return {
    x: t.tx + p.x * c - py * s,
    y: t.ty + p.x * s + py * c,
  };
}
function applyHeading(t: Transform, h: number): number {
  return t.rot + (t.mirror ? -h : h);
}

/** Module-local centre-line (main A→B), sampling arcs, mirror-agnostic. */
function localCenterline(m: FootprintModule): Pt[] {
  const L =
    (m.mainlineLengthInches && m.mainlineLengthInches > 0
      ? m.mainlineLengthInches
      : m.lengthTotalInches && m.lengthTotalInches > 0
        ? m.lengthTotalInches
        : 24) || 24;
  const gt = m.geometryType;
  if (gt === "dead_end") return [{ x: 0, y: 0 }];
  if (gt === "offset") {
    return [
      { x: 0, y: 0 },
      { x: L, y: m.geometryOffsetInches ?? 0 },
    ];
  }
  const turn =
    gt === "corner_45"
      ? 45
      : gt === "corner_90"
        ? 90
        : gt === "curve"
          ? (m.geometryDegrees ?? 0)
          : 0;
  if (turn === 0)
    return [
      { x: 0, y: 0 },
      { x: L, y: 0 },
    ];
  const t = turn * DEG;
  const r = L / t;
  const steps = 12;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (t * i) / steps;
    pts.push({ x: r * Math.sin(a), y: r * (1 - Math.cos(a)) });
  }
  return pts;
}

/** Assemble the deriveEndplatePoses input for a module. */
function poseInput(m: FootprintModule) {
  const doc = asModuleSchematic(m.schematic);
  const epById = new Map((doc?.endplates ?? []).map((e) => [e.id, e]));
  const cfg = (id: string): "single" | "double" =>
    epById.get(id)?.tracks?.[0]?.config === "double" ? "double" : "single";
  const branches = (doc?.endplates ?? [])
    .filter((e) => e.id !== "A" && e.id !== "B" && e.at)
    .map((e) => ({
      id: e.id,
      atPos: e.at!.pos,
      side: e.at!.side === "down" ? ("down" as const) : ("up" as const),
      config: cfg(e.id),
    }));
  return {
    lengthInches:
      (m.mainlineLengthInches && m.mainlineLengthInches > 0
        ? m.mainlineLengthInches
        : m.lengthTotalInches && m.lengthTotalInches > 0
          ? m.lengthTotalInches
          : 24) || 24,
    geometryType: m.geometryType,
    geometryDegrees: m.geometryDegrees,
    geometryOffsetInches: m.geometryOffsetInches,
    endplateConfigs: [cfg("A"), cfg("B")],
    branches,
  };
}

/**
 * Solve the layout footprint: place a root module at the origin, then BFS the
 * joins placing each neighbour by the mating constraint (shared point, opposite
 * headings). Joins between two already-placed modules yield a closure error.
 */
export function composeFootprint(
  modules: FootprintModule[],
  joins: LayoutJoin[],
): Footprint {
  const byId = new Map(modules.map((m) => [m.id, m]));
  // Per-module local poses + a quick pose lookup.
  const localPoses = new Map<string, EndplatePose[]>();
  const poseOf = (mid: string, ep: string): EndplatePose | undefined =>
    localPoses.get(mid)?.find((p) => p.id === ep);
  for (const m of modules) localPoses.set(m.id, deriveEndplatePoses(poseInput(m)));

  // Adjacency: placement -> joins touching it.
  const adj = new Map<string, LayoutJoin[]>();
  for (const j of joins) {
    for (const pid of [j.a.placementId, j.b.placementId]) {
      const arr = adj.get(pid) ?? [];
      arr.push(j);
      adj.set(pid, arr);
    }
  }

  const transforms = new Map<string, Transform>();
  const closures: ClosureError[] = [];
  // Each join is handled once (it appears in adjacency from both ends).
  const usedJoins = new Set<string>();

  // Place a module given its transform, recording world endplate poses.
  const worldEndplate = (mid: string, ep: string) => {
    const t = transforms.get(mid)!;
    const p = poseOf(mid, ep)!;
    const pt = applyPoint(t, { x: p.x, y: p.y });
    return { x: pt.x, y: pt.y, heading: applyHeading(t, p.heading) };
  };

  // BFS over connected components; each unplaced module seeds a component at
  // the origin (identity, honouring its mirror flag).
  const queue: string[] = [];
  for (const root of modules) {
    if (transforms.has(root.id)) continue;
    transforms.set(root.id, { rot: 0, tx: 0, ty: 0, mirror: !!root.mirrored });
    queue.push(root.id);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const j of adj.get(cur) ?? []) {
        if (usedJoins.has(j.id)) continue; // already a tree edge or a closure
        // Identify the far side of this join.
        const near = j.a.placementId === cur ? j.a : j.b;
        const far = j.a.placementId === cur ? j.b : j.a;
        if (!byId.has(far.placementId)) continue; // dangling
        usedJoins.add(j.id);
        const nearWorld = worldEndplate(cur, near.endplateId);
        if (transforms.has(far.placementId)) {
          // Cycle: both placed — measure closure against the far end.
          const farWorld = worldEndplate(far.placementId, far.endplateId);
          const gap = Math.hypot(
            nearWorld.x - farWorld.x,
            nearWorld.y - farWorld.y,
          );
          const angle = Math.abs(
            norm180(nearWorld.heading + 180 - farWorld.heading),
          );
          // A cyclic join places nothing new; its gap is the closure error
          // (0 = the ring closes cleanly).
          closures.push({ joinId: j.id, gapInches: gap, gapDegrees: angle });
          continue;
        }
        // Place `far` so its endplate mates the near one: same point, opposite
        // outward normal.
        const farLocal = poseOf(far.placementId, far.endplateId);
        if (!farLocal) continue;
        const mirror = !!byId.get(far.placementId)?.mirrored;
        const localH = mirror ? -farLocal.heading : farLocal.heading;
        const rot = nearWorld.heading + 180 - localH;
        // t so that rotate(reflect(farLocal.point)) + t = nearWorld.point
        const base = applyPoint({ rot, tx: 0, ty: 0, mirror }, {
          x: farLocal.x,
          y: farLocal.y,
        });
        transforms.set(far.placementId, {
          rot,
          tx: nearWorld.x - base.x,
          ty: nearWorld.y - base.y,
          mirror,
        });
        queue.push(far.placementId);
      }
    }
  }

  // Build placed output + bbox.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const track = (p: Pt) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  const placed: PlacedModule[] = [];
  const unplaced: string[] = [];
  for (const m of modules) {
    const t = transforms.get(m.id);
    if (!t) {
      unplaced.push(m.id);
      continue;
    }
    const centerline = localCenterline(m).map((p) => applyPoint(t, p));
    centerline.forEach(track);
    const endplates = (localPoses.get(m.id) ?? []).map((p) => {
      const w = worldEndplate(m.id, p.id);
      track(w);
      return { id: p.id, x: w.x, y: w.y, heading: w.heading };
    });
    placed.push({
      id: m.id,
      moduleName: m.moduleName ?? null,
      endplates,
      centerline,
    });
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  return { placed, bbox: { minX, minY, maxX, maxY }, closures, unplaced };
}

/** Convenience: build the footprint straight from spines + stored joins. */
export function layoutFootprint(
  spines: JoinSpine[],
  storedJoins: LayoutJoin[],
  modules: FootprintModule[],
): Footprint {
  return composeFootprint(modules, layoutJoins(spines, storedJoins));
}
