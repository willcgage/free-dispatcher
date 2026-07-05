/**
 * Owner-authored module schematic (#122) — the structured track-graph the Module
 * Repository builds and Free-Dispatcher imports. See
 * docs/module-schematic-format.md. This module holds the doc types, a lenient
 * parser (it arrives as jsonb / unknown), and a pure helper that resolves the
 * graph into positioned, drawable features for the operations schematic.
 *
 * Positions are 1-D inches along the module (from endplate A); this helper
 * normalises them to fractions [0,1] so the renderer only needs the module's
 * cell width. Lanes are integer track indices (0 = primary main).
 */

export interface SchematicEndplateTrack {
  trackId: string;
  lane: number;
  config?: string | null;
}
export interface SchematicEndplate {
  id: string;
  label?: string | null;
  tracks?: SchematicEndplateTrack[];
}
export interface SchematicTrack {
  id: string;
  role: string; // main | siding | spur | yard | crossover
  lane: number;
  from?: string;
  to?: string;
  fromPos?: number | null;
  toPos?: number | null;
  capacityFeet?: number | null;
  industryRef?: number | null;
}
export interface SchematicTurnout {
  id: string;
  pos: number;
  onTrack: string;
  divergeTrack: string;
  kind?: string;
  name?: string | null;
  address?: string | null;
}
export interface SchematicSignal {
  id: string;
  pos: number;
  track?: string;
  facing?: string; // AtoB | BtoA
  kind?: string;
  name?: string | null;
  aspects?: string[];
  /** Which side of the track the signal sits on (#122). */
  side?: string; // above | below
  /** Turnout this control point governs; absent = standalone block signal (#122). */
  turnout?: string;
}
export interface SchematicBlock {
  id: string;
  name: string;
  tracks?: string[];
  from: number;
  to: number;
}
/** An interlocking: a named group of signals and the turnout(s) it governs (#122). */
export interface SchematicControlPoint {
  id: string;
  name?: string | null;
  turnouts?: string[];
  signals?: SchematicSignal[];
}
export interface ModuleSchematicDoc {
  version: number;
  module?: string;
  lengthInches?: number;
  endplates: SchematicEndplate[];
  tracks: SchematicTrack[];
  turnouts?: SchematicTurnout[];
  controlPoints?: SchematicControlPoint[];
  /** @deprecated pre-grouping flat signals; read for back-compat. */
  signals?: SchematicSignal[];
}

/** Parse a jsonb value into a schematic doc, or null if it isn't one. */
export function asModuleSchematic(x: unknown): ModuleSchematicDoc | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  if (typeof d.version !== "number") return null;
  if (!Array.isArray(d.endplates) || !Array.isArray(d.tracks)) return null;
  return d as unknown as ModuleSchematicDoc;
}

// ---- Drawable features (module-local, fraction 0..1 along the module) ------

export interface DrawTrack {
  id: string;
  role: string;
  lane: number;
  fromFrac: number;
  toFrac: number;
  capacityFeet: number | null;
}
export interface DrawTurnout {
  id: string;
  name: string | null;
  posFrac: number;
  onLane: number;
  divergeLane: number;
}
export interface DrawSignal {
  id: string;
  name: string | null;
  posFrac: number;
  lane: number;
  facing: string;
  side: string; // above | below
}
export interface ModuleFeatures {
  /** Non-main tracks (sidings/spurs/yard/crossover). */
  extraTracks: DrawTrack[];
  turnouts: DrawTurnout[];
  signals: DrawSignal[];
}

/**
 * Resolve a schematic doc into positioned drawables. `pos` (inches) becomes a
 * fraction of the module length; endplate A = 0, B = length; turnouts sit at
 * their pos. Tracks may carry explicit fromPos/toPos (overriding node lookup).
 */
export function moduleFeatures(doc: ModuleSchematicDoc): ModuleFeatures {
  const len =
    doc.lengthInches && doc.lengthInches > 0
      ? doc.lengthInches
      : Math.max(
          1,
          ...doc.tracks.map((t) => Math.max(t.fromPos ?? 0, t.toPos ?? 0)),
          ...(doc.turnouts ?? []).map((t) => t.pos),
        );

  const trackLane = new Map<string, number>();
  for (const t of doc.tracks) trackLane.set(t.id, t.lane);

  // Endplate positions: first endplate = West (0), the rest = East (len).
  const endplatePos = new Map<string, number>();
  doc.endplates.forEach((e, i) => endplatePos.set(e.id, i === 0 ? 0 : len));

  const turnoutPos = new Map<string, number>();
  for (const t of doc.turnouts ?? []) turnoutPos.set(t.id, t.pos);

  const posOf = (nodeId?: string): number | null => {
    if (nodeId == null) return null;
    if (endplatePos.has(nodeId)) return endplatePos.get(nodeId)!;
    if (turnoutPos.has(nodeId)) return turnoutPos.get(nodeId)!;
    return null;
  };
  // To-scale: features render at their true position (inches from endplate A),
  // clamped only to the module's extent — so signals near an end read at their
  // real spot, not bunched at an inset (#122).
  const clampFrac = (p: number) => Math.min(1, Math.max(0, p / len));

  const extraTracks: DrawTrack[] = [];
  for (const t of doc.tracks) {
    if (t.role === "main") continue; // the spine draws mains
    const from = t.fromPos ?? posOf(t.from);
    const to = t.toPos ?? posOf(t.to);
    if (from == null || to == null) continue; // can't place it
    extraTracks.push({
      id: t.id,
      role: t.role,
      lane: t.lane,
      fromFrac: clampFrac(Math.min(from, to)),
      toFrac: clampFrac(Math.max(from, to)),
      capacityFeet: t.capacityFeet ?? null,
    });
  }

  const turnouts: DrawTurnout[] = (doc.turnouts ?? []).map((t) => ({
    id: t.id,
    name: t.name ?? null,
    posFrac: clampFrac(t.pos),
    onLane: trackLane.get(t.onTrack) ?? 0,
    divergeLane: trackLane.get(t.divergeTrack) ?? 1,
  }));

  const drawSignal = (s: SchematicSignal, name: string | null): DrawSignal => ({
    id: s.id,
    name,
    posFrac: clampFrac(s.pos),
    lane: s.track ? (trackLane.get(s.track) ?? 0) : 0,
    facing: s.facing ?? "AtoB",
    side: s.side === "below" ? "below" : "above",
  });
  // Signals come from control-point groups; fall back to pre-grouping flat
  // signals for modules authored before the model changed.
  const signals: DrawSignal[] = Array.isArray(doc.controlPoints)
    ? doc.controlPoints.flatMap((c) =>
        (c.signals ?? []).map((s) => drawSignal(s, c.name ?? null)),
      )
    : (doc.signals ?? []).map((s) => drawSignal(s, s.name ?? null));

  return { extraTracks, turnouts, signals };
}
