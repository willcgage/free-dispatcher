/**
 * Module benchwork outline (physical footprint) — a ribbon centred on the
 * module's main-track centre-line, its depth at each end set by that endplate's
 * authored FACE width. This turns the layout map from hairline tracks into solid
 * pieces you can see and grab, with endplate FACES (an edge across the module
 * end) you position and mate. Pure so it unit-tests without a DOM.
 *
 * The endplate face is the accurate, standardized interface (Free-moN: 12″ min,
 * 24″ recommended, 6″ high — height is elevation, unseen top-down). The body
 * between the two ends is approximate: the band simply tapers from one end's
 * width to the other's.
 */
import type { Pt } from "./footprint";

/**
 * Recommended Free-moN endplate width (plan-view depth), inches — the default a
 * module is drawn at until it authors its own per-endplate width (12″ min, 24″
 * recommended per the standard).
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

/** Fraction 0→1 along the centre-line by arc length (0 at the A end, 1 at B). */
function arcFractions(center: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < center.length; i++)
    cum.push(cum[i - 1] + Math.hypot(center[i].x - center[i - 1].x, center[i].y - center[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  return cum.map((d) => d / total);
}

/**
 * Closed benchwork polygon: the centre-line offset ±half-width, out and back.
 * The half-width tapers linearly from `widthA`/2 at the A end to `widthB`/2 at
 * the B end, so a module whose two endplates differ in width reads correctly.
 */
export function bandOutline(
  center: Pt[],
  widthA = FREEMON_ENDPLATE_WIDTH_INCHES,
  widthB = FREEMON_ENDPLATE_WIDTH_INCHES,
): Pt[] {
  if (center.length < 2) return [];
  const n = normals(center);
  const f = arcFractions(center);
  const half = (i: number) => (widthA * (1 - f[i]) + widthB * f[i]) / 2;
  const left = center.map((p, i) => ({ x: p.x + n[i].x * half(i), y: p.y + n[i].y * half(i) }));
  const right = center.map((p, i) => ({ x: p.x - n[i].x * half(i), y: p.y - n[i].y * half(i) }));
  return [...left, ...right.reverse()];
}

export interface OutlineFace {
  /** The two corners of the endplate face (across the module end). */
  p1: Pt;
  p2: Pt;
  /** Face midpoint (the endplate point) and outward direction. */
  mid: Pt;
}

/** The two endplate faces (the ribbon's flat ends): [A end at widthA, B end at
 * widthB]. Each is drawn at its own authored width. */
export function endplateFaces(
  center: Pt[],
  widthA = FREEMON_ENDPLATE_WIDTH_INCHES,
  widthB = FREEMON_ENDPLATE_WIDTH_INCHES,
): OutlineFace[] {
  if (center.length < 2) return [];
  const n = normals(center);
  const face = (i: number, width: number): OutlineFace => ({
    p1: { x: center[i].x + n[i].x * (width / 2), y: center[i].y + n[i].y * (width / 2) },
    p2: { x: center[i].x - n[i].x * (width / 2), y: center[i].y - n[i].y * (width / 2) },
    mid: { x: center[i].x, y: center[i].y },
  });
  return [face(0, widthA), face(center.length - 1, widthB)];
}
