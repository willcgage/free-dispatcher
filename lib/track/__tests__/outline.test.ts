import { describe, it, expect } from "vitest";
import { bandOutline, endplateFaces, FREEMON_ENDPLATE_WIDTH_INCHES } from "../outline";

describe("bandOutline", () => {
  it("turns a straight centre-line into a rectangle of the given width", () => {
    // horizontal A→B, both ends 12″ → rectangle ±6 around y=0
    const poly = bandOutline([{ x: 0, y: 0 }, { x: 40, y: 0 }], 12, 12);
    expect(poly).toHaveLength(4);
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-6);
    expect(ys[3]).toBeCloseTo(6);
    const xs = poly.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(40);
  });

  it("tapers when the two endplates differ in width", () => {
    // A end 12″ (half 6), B end 24″ (half 12): the band widens A→B.
    const poly = bandOutline([{ x: 0, y: 0 }, { x: 40, y: 0 }], 12, 24);
    // left offsets at each vertex: A vertex ±6, B vertex ±12
    const atA = poly.filter((p) => Math.abs(p.x - 0) < 1e-6).map((p) => Math.abs(p.y));
    const atB = poly.filter((p) => Math.abs(p.x - 40) < 1e-6).map((p) => Math.abs(p.y));
    expect(Math.max(...atA)).toBeCloseTo(6);
    expect(Math.max(...atB)).toBeCloseTo(12);
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
  it("draws each end face at its own authored width", () => {
    // A end 12″ (±6), B end 24″ (±12).
    const [a, b] = endplateFaces([{ x: 0, y: 0 }, { x: 40, y: 0 }], 12, 24);
    expect(a.mid).toEqual({ x: 0, y: 0 });
    expect(b.mid).toEqual({ x: 40, y: 0 });
    expect(Math.abs(a.p1.y - a.p2.y)).toBeCloseTo(12); // A face spans 12″
    expect(Math.abs(b.p1.y - b.p2.y)).toBeCloseTo(24); // B face spans 24″
    expect(a.p1.x).toBeCloseTo(0);
  });
});
