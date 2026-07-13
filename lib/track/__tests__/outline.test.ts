import { describe, it, expect } from "vitest";
import { bandOutline, endplateFaces, FREEMON_ENDPLATE_WIDTH_INCHES } from "../outline";

describe("bandOutline", () => {
  it("turns a straight centre-line into a rectangle of the given depth", () => {
    // horizontal A→B, depth 12 → rectangle ±6 around y=0
    const poly = bandOutline([{ x: 0, y: 0 }, { x: 40, y: 0 }], 12);
    expect(poly).toHaveLength(4);
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-6);
    expect(ys[3]).toBeCloseTo(6);
    const xs = poly.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(40);
  });

  it("defaults to the 24 inch recommended Free-moN endplate width", () => {
    const poly = bandOutline([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(FREEMON_ENDPLATE_WIDTH_INCHES).toBe(24);
    expect(Math.max(...poly.map((p) => p.y))).toBeCloseTo(12);
  });

  it("returns empty for a degenerate centre-line", () => {
    expect(bandOutline([{ x: 0, y: 0 }])).toEqual([]);
  });
});

describe("endplateFaces", () => {
  it("gives a face across each end, midpoint at the endplate point", () => {
    const [a, b] = endplateFaces([{ x: 0, y: 0 }, { x: 40, y: 0 }], 12);
    expect(a.mid).toEqual({ x: 0, y: 0 });
    expect(b.mid).toEqual({ x: 40, y: 0 });
    // the A face spans the full depth across the end (y from -6 to +6)
    expect(Math.abs(a.p1.y - a.p2.y)).toBeCloseTo(12);
    expect(a.p1.x).toBeCloseTo(0);
  });
});
