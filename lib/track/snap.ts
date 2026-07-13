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
  /** Track config for compatibility, or null when unknown. */
  config: "single" | "double" | null;
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
