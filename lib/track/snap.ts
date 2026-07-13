/**
 * Snap geometry for the drag-and-drop Layout canvas (#reverse follow-up).
 *
 * While a module is dragged, its endplates move with it; when one comes within
 * a snap radius of another module's endplate, that pair is a candidate join. On
 * drop the candidate becomes a real endplate join and the footprint solver mates
 * them exactly. Compatibility (single↔single, double↔double) is advisory — the
 * canvas still lets an incompatible pair snap, flagged, so a user can Reverse a
 * module to fix it (matching the mismatch model).
 *
 * Pure so it unit-tests without a DOM.
 */

export interface CanvasEndplate {
  placementId: string;
  endplateId: string;
  /** World position (layout inches). */
  x: number;
  y: number;
  /** Outward normal (degrees) — for face-to-face mating; optional for point snap. */
  heading?: number;
  /** Track config for compatibility, or null when unknown. */
  config: "single" | "double" | null;
}

/** Smallest angle between two headings, 0–180°. */
function angleBetween(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export interface SnapHit {
  drag: CanvasEndplate;
  target: CanvasEndplate;
  distance: number;
  compatible: boolean;
}

/**
 * The nearest endplate of another module within `radius` of any dragged
 * endplate — the pair the drop would join. Null when nothing is close.
 */
export function findSnap(
  dragEndplates: CanvasEndplate[],
  targetEndplates: CanvasEndplate[],
  radius: number,
): SnapHit | null {
  let best: SnapHit | null = null;
  for (const d of dragEndplates) {
    for (const t of targetEndplates) {
      if (t.placementId === d.placementId) continue;
      const distance = Math.hypot(d.x - t.x, d.y - t.y);
      if (distance > radius) continue;
      if (!best || distance < best.distance) {
        best = {
          drag: d,
          target: t,
          distance,
          compatible:
            d.config != null && t.config != null && d.config === t.config,
        };
      }
    }
  }
  return best;
}

/**
 * Face-to-face variant: the dragged endplate FACE must also be pointing at the
 * target (their outward normals within `angleTol` of opposite), so the two
 * modules meet the way you'd physically clamp their endplates — not merely be
 * near each other. This is what drives the magnetic mate.
 */
export function findFaceSnap(
  dragEndplates: CanvasEndplate[],
  targetEndplates: CanvasEndplate[],
  radius: number,
  angleTol = 40,
): SnapHit | null {
  let best: SnapHit | null = null;
  for (const d of dragEndplates) {
    if (d.heading == null) continue;
    for (const t of targetEndplates) {
      if (t.placementId === d.placementId || t.heading == null) continue;
      const distance = Math.hypot(d.x - t.x, d.y - t.y);
      if (distance > radius) continue;
      // Faces meet when the outward normals are ~opposite (180° apart).
      if (angleBetween(d.heading, t.heading + 180) > angleTol) continue;
      if (!best || distance < best.distance) {
        best = {
          drag: d,
          target: t,
          distance,
          compatible:
            d.config != null && t.config != null && d.config === t.config,
        };
      }
    }
  }
  return best;
}
