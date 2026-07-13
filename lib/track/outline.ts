/**
 * Module benchwork outline (physical footprint) — a ribbon of the standard
 * Free-moN endplate width, centred on the module's main-track centre-line. This
 * turns the layout map from hairline tracks into solid pieces you can see and
 * grab, with endplate FACES (an edge across the module end) you position and
 * mate. Pure so it unit-tests without a DOM.
 *
 * Free-moN endplates are 12″ wide (min) and 6″ high; height is elevation, not
 * seen in a top-down map, so the plan-view band is 12″ deep.
 */
import type { Pt } from "./footprint";

/**
 * Standard Free-moN endplate width (module depth in plan view), inches — the
 * connection interface. 12″ is the spec minimum, 24″ the recommended default;
 * we render the recommended width until a module authors its own.
 */
export const FREEMON_ENDPLATE_WIDTH_INCHES = 24;

/** Unit perpendicular (left normal) of the local direction at each vertex. */
function normals(center: Pt[]): Pt[] {
  return center.map((_, i) => {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(center.length - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return { x: -dy, y: dx }; // left normal
  });
}

/** Closed benchwork polygon: the centre-line offset ±depth/2, out and back. */
export function bandOutline(
  center: Pt[],
  depth = FREEMON_ENDPLATE_WIDTH_INCHES,
): Pt[] {
  if (center.length < 2) return [];
  const half = depth / 2;
  const n = normals(center);
  const left = center.map((p, i) => ({ x: p.x + n[i].x * half, y: p.y + n[i].y * half }));
  const right = center.map((p, i) => ({ x: p.x - n[i].x * half, y: p.y - n[i].y * half }));
  return [...left, ...right.reverse()];
}

export interface OutlineFace {
  /** The two corners of the endplate face (across the module end). */
  p1: Pt;
  p2: Pt;
  /** Face midpoint (the endplate point) and outward direction. */
  mid: Pt;
}

/** The two endplate faces (the ribbon's flat ends): [A end, B end]. */
export function endplateFaces(
  center: Pt[],
  depth = FREEMON_ENDPLATE_WIDTH_INCHES,
): OutlineFace[] {
  if (center.length < 2) return [];
  const half = depth / 2;
  const n = normals(center);
  const face = (i: number): OutlineFace => ({
    p1: { x: center[i].x + n[i].x * half, y: center[i].y + n[i].y * half },
    p2: { x: center[i].x - n[i].x * half, y: center[i].y - n[i].y * half },
    mid: { x: center[i].x, y: center[i].y },
  });
  return [face(0), face(center.length - 1)];
}
