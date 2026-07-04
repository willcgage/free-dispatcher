/**
 * Schematic geometry (#115, phase 2) — turn a layout's module sequence into a
 * to-scale 2D polyline by walking the modules end-to-end, applying each one's
 * turn (curves bend by their degrees; corner_90 turns 90°; everything else runs
 * straight). Pure so it can be unit-tested; the SVG component just draws it.
 *
 * Orientation/flip (which way a curve bends) isn't in the catalog yet, so all
 * curves bend the same way — good enough for a schematic; true orientation is a
 * later drag-place phase.
 */

export interface SchematicInput {
  id: string;
  moduleId?: string;
  moduleName?: string | null;
  stagingEnd?: "A" | "B" | null;
  hasMss?: boolean | null;
  lengthTotalInches: number | null;
  geometryType: string | null;
  geometryDegrees: number | null;
  /** Mirror the placement so the curve bends the other way. */
  flipped?: boolean | null;
  /** Endplate track configs, used for connection checks (#115). */
  endplates?: { label?: string | null; track_config?: string | null }[] | null;
}

export interface Pt {
  x: number;
  y: number;
}
export interface SchematicSegment {
  input: SchematicInput;
  points: Pt[];
  mid: Pt;
}
export interface Schematic {
  segments: SchematicSegment[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Total run in inches. */
  totalInches: number;
}

export const DEFAULT_LEN = 24;

/** Degrees a module turns the track. Curves use their degrees; corner_90 = 90°. */
export function turnDegrees(
  geometryType: string | null,
  geometryDegrees: number | null,
): number {
  if (geometryType === "curve") return geometryDegrees ?? 0;
  if (geometryType === "corner_90") return 90;
  return 0;
}

export function buildSchematic(modules: SchematicInput[]): Schematic {
  let x = 0;
  let y = 0;
  let theta = 0; // radians, 0 = east (+x)
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let totalInches = 0;
  const track = (px: number, py: number) => {
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  };

  const segments: SchematicSegment[] = [];
  for (const m of modules) {
    const L =
      m.lengthTotalInches && m.lengthTotalInches > 0
        ? m.lengthTotalInches
        : DEFAULT_LEN;
    totalInches += L;
    const deg =
      turnDegrees(m.geometryType, m.geometryDegrees) * (m.flipped ? -1 : 1);
    const turn = (deg * Math.PI) / 180;
    const steps = turn === 0 ? 1 : 12;
    const points: Pt[] = [{ x, y }];
    for (let i = 0; i < steps; i++) {
      x += (L / steps) * Math.cos(theta);
      y += (L / steps) * Math.sin(theta);
      theta += turn / steps;
      points.push({ x, y });
      track(x, y);
    }
    segments.push({ input: m, points, mid: points[Math.floor(points.length / 2)] });
  }

  return { segments, bbox: { minX, minY, maxX, maxY }, totalInches };
}
