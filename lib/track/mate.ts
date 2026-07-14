/**
 * Flush endplate mating for the Arrange canvas.
 *
 * Modules connect endplate-to-endplate, always FLUSH — a module can never rest
 * with an endplate floating in open space. So when a dragged module's free
 * endplate is brought near another module's free endplate, we compute the rigid
 * transform that lands the two faces flush: the same physical point, outward
 * normals exactly opposite. The rotation is whatever that takes — a corner
 * module's free face swings fully around to meet its neighbour. Rotation is
 * therefore never dialed in by hand; it is entirely derived from the endplate
 * being matched. Pure so it unit-tests without a DOM.
 */
import type { Pt } from "./footprint";

/** Rotate `rot`° about a pivot, then translate so the pivot lands on (tx, ty). */
export interface MatePose {
  rot: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
}

const DEG = Math.PI / 180;

/**
 * The pose that lands the dragged module's `drag` endplate flush on `target`:
 * coincident point, opposite outward normal. Independent of the dragged
 * module's starting angle — that's what lets a corner's face come around to
 * clamp.
 */
export function flushMatePose(
  drag: { x: number; y: number; heading: number },
  target: { x: number; y: number; heading: number },
): MatePose {
  return {
    rot: target.heading + 180 - drag.heading,
    px: drag.x,
    py: drag.y,
    tx: target.x,
    ty: target.y,
  };
}

/** Apply a mate pose to a point (rotate about the pivot, then translate). */
export function applyMatePose(p: Pt, pose: MatePose): Pt {
  const a = pose.rot * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const rx = (p.x - pose.px) * c - (p.y - pose.py) * s;
  const ry = (p.x - pose.px) * s + (p.y - pose.py) * c;
  return { x: rx + pose.tx, y: ry + pose.ty };
}

/** How a heading (outward normal) turns under a mate pose. */
export function matedHeading(heading: number, pose: MatePose): number {
  return heading + pose.rot;
}
