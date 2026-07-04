import { describe, it, expect } from "vitest";
import { buildSchematic, turnDegrees, type SchematicInput } from "../schematic";

const straight = (id: string, len: number): SchematicInput => ({
  id,
  lengthTotalInches: len,
  geometryType: "straight",
  geometryDegrees: null,
});

describe("turnDegrees", () => {
  it("bends only curves and 90° corners", () => {
    expect(turnDegrees("straight", null)).toBe(0);
    expect(turnDegrees("curve", 22.5)).toBe(22.5);
    expect(turnDegrees("corner_90", null)).toBe(90);
    expect(turnDegrees("wye", null)).toBe(0);
    expect(turnDegrees("other", null)).toBe(0);
  });
});

describe("buildSchematic", () => {
  it("runs straights east, accumulating length", () => {
    const s = buildSchematic([straight("a", 30), straight("b", 18)]);
    expect(s.totalInches).toBe(48);
    // Two straights stay on the x-axis.
    expect(Math.round(s.bbox.maxX)).toBe(48);
    expect(Math.round(s.bbox.maxY)).toBe(0);
    expect(Math.round(s.bbox.minY)).toBe(0);
    // Each segment carries its own polyline.
    expect(s.segments).toHaveLength(2);
    expect(s.segments[0].points[0]).toEqual({ x: 0, y: 0 });
  });

  it("bends the track on a curve (leaves the x-axis)", () => {
    const s = buildSchematic([
      straight("a", 30),
      { id: "c", lengthTotalInches: 42, geometryType: "corner_90", geometryDegrees: null },
      straight("b", 30),
    ]);
    // A 90° corner turns the run, so the bounding box gains height.
    expect(s.bbox.maxY - s.bbox.minY).toBeGreaterThan(5);
  });

  it("falls back to a default length when a module has none", () => {
    const s = buildSchematic([
      { id: "x", lengthTotalInches: null, geometryType: "other", geometryDegrees: null },
    ]);
    expect(s.totalInches).toBe(24);
  });
});
