/**
 * Arrange-canvas transient transforms (#face-to-face follow-up: rotate control).
 *
 * While arranging, a module can be manually nudged (dx, dy) and ROTATED (rot°)
 * on top of its solved pose — purely to bring an endplate FACE around to oppose
 * a neighbour so the magnetic mate can fire. Nothing here is persisted: once a
 * join is committed the footprint solver owns the real orientation. Pure so it
 * unit-tests without a DOM.
 */
import type { Pt } from "./footprint";

/** A transient manual transform: rotate `rot`° about a pivot, then translate. */
export interface Xf {
  dx: number;
  dy: number;
  rot: number;
}

export const ZERO_XF: Xf = { dx: 0, dy: 0, rot: 0 };

const DEG = Math.PI / 180;

/** Rotate `p` about `pivot` by `xf.rot`°, then translate by (dx, dy). */
export function applyXf(p: Pt, xf: Xf, pivot: Pt): Pt {
  const a = xf.rot * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ox = p.x - pivot.x;
  const oy = p.y - pivot.y;
  return {
    x: pivot.x + ox * c - oy * s + xf.dx,
    y: pivot.y + ox * s + oy * c + xf.dy,
  };
}

/**
 * Apply an Xf to an endplate: its point rotates+translates about the pivot and
 * its outward normal (heading) turns by `rot`. Position drives proximity; the
 * turned heading is what lets a corner's face come around to oppose a target.
 */
export function xfEndplate<T extends { x: number; y: number; heading?: number }>(
  e: T,
  xf: Xf,
  pivot: Pt,
): T {
  const p = applyXf(e, xf, pivot);
  return { ...e, x: p.x, y: p.y, heading: (e.heading ?? 0) + xf.rot };
}
