/**
 * Benchwork-outline arc sampling — expand an authored outline (whose edges may
 * be circular arcs via a per-vertex `bulge`) into a dense closed polyline. This
 * mirrors `sampleBenchworkOutline` in @willcgage/module-schematic exactly so a
 * curve looks identical in the Repository preview and here; kept local so FD
 * renders curves without depending on the package's published typings. Pure.
 */
import type { Pt } from "./footprint";

export interface OutlineVertex {
  x: number;
  y: number;
  /** Signed sagitta (inches) of the arc from this vertex to the next; the arc
   * midpoint is offset `bulge` perpendicular (+ = left of P→next) from the
   * chord. 0/absent = straight edge. */
  bulge?: number;
}

/** Expand an outline into a closed polyline, tessellating each bulged edge. */
export function sampleOutline(pts: OutlineVertex[], segsPerArc = 20): Pt[] {
  const n = pts.length;
  if (n < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    out.push({ x: p0.x, y: p0.y });
    const bulge = p0.bulge ?? 0;
    if (!bulge) continue;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy);
    if (c < 1e-6) continue;
    const nx = -dy / c;
    const ny = dx / c;
    const mid = { x: (p0.x + p1.x) / 2 + nx * bulge, y: (p0.y + p1.y) / 2 + ny * bulge };
    const circ = circleThrough(p0, mid, p1);
    if (!circ) continue;
    const a0 = Math.atan2(p0.y - circ.cy, p0.x - circ.cx);
    const am = Math.atan2(mid.y - circ.cy, mid.x - circ.cx);
    const a1 = Math.atan2(p1.y - circ.cy, p1.x - circ.cx);
    const sweep = arcSweep(a0, a1, am);
    for (let s = 1; s < segsPerArc; s++) {
      const a = a0 + (sweep * s) / segsPerArc;
      out.push({ x: circ.cx + circ.r * Math.cos(a), y: circ.cy + circ.r * Math.sin(a) });
    }
  }
  return out;
}

function circleThrough(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}

function arcSweep(a0: number, a1: number, am: number): number {
  const norm = (x: number) => {
    let v = (x - a0) % (2 * Math.PI);
    if (v < 0) v += 2 * Math.PI;
    return v;
  };
  const m = norm(am);
  const one = norm(a1);
  return m <= one ? one : one - 2 * Math.PI;
}
