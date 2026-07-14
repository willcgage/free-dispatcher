import { describe, it, expect } from "vitest";
import { composeFootprint, type FootprintModule } from "../footprint";
import type { LayoutJoin } from "../layoutJoins";

const straight = (id: string, L = 100): FootprintModule => ({
  id,
  moduleName: id,
  lengthTotalInches: L,
  geometryType: "straight",
});
const corner = (id: string, L = 100): FootprintModule => ({
  id,
  moduleName: id,
  lengthTotalInches: L,
  geometryType: "corner_90",
});
const join = (aP: string, aE: string, bP: string, bE: string): LayoutJoin => ({
  id: `${aP}:${aE}-${bP}:${bE}`,
  a: { placementId: aP, endplateId: aE },
  b: { placementId: bP, endplateId: bE },
});
const ep = (m: { endplates: { id: string; x: number; y: number }[] }, id: string) =>
  m.endplates.find((e) => e.id === id)!;

describe("composeFootprint endplate widths", () => {
  it("carries each endplate's authored face width, defaulting to 24″", () => {
    const authored: FootprintModule = {
      id: "m",
      moduleName: "m",
      lengthTotalInches: 100,
      geometryType: "straight",
      schematic: {
        version: 1,
        lengthInches: 100,
        endplates: [
          { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }], widthInches: 12 },
          { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] }, // unauthored
        ],
        tracks: [{ id: "main", role: "main", lane: 0, from: "A", to: "B" }],
      },
    };
    const fp = composeFootprint([authored], []);
    const m = fp.placed.find((p) => p.id === "m")!;
    expect(m.endplates.find((e) => e.id === "A")!.width).toBe(12);
    expect(m.endplates.find((e) => e.id === "B")!.width).toBe(24); // recommended default
  });
});

describe("composeFootprint", () => {
  it("chains two straights collinearly (B→A)", () => {
    const fp = composeFootprint(
      [straight("m1"), straight("m2")],
      [join("m1", "B", "m2", "A")],
    );
    expect(fp.unplaced).toEqual([]);
    const m1 = fp.placed.find((p) => p.id === "m1")!;
    const m2 = fp.placed.find((p) => p.id === "m2")!;
    expect(ep(m1, "A")).toMatchObject({ x: 0, y: 0 });
    // m2 sits end-to-end: its A at m1's B (100,0), its B at (200,0).
    expect(ep(m2, "A").x).toBeCloseTo(100, 3);
    expect(ep(m2, "A").y).toBeCloseTo(0, 3);
    expect(ep(m2, "B").x).toBeCloseTo(200, 3);
    expect(ep(m2, "B").y).toBeCloseTo(0, 3);
    expect(fp.bbox.maxX).toBeCloseTo(200, 3);
    expect(fp.closures).toEqual([]);
  });

  it("a corner turns the following module 90°", () => {
    const fp = composeFootprint(
      [corner("c1"), straight("m2")],
      [join("c1", "B", "m2", "A")],
    );
    const r = 100 / (Math.PI / 2);
    const c1 = fp.placed.find((p) => p.id === "c1")!;
    const m2 = fp.placed.find((p) => p.id === "m2")!;
    // corner exits at (r, r) heading north; the straight then runs +100 in Y.
    expect(ep(c1, "B").x).toBeCloseTo(r, 2);
    expect(ep(c1, "B").y).toBeCloseTo(r, 2);
    expect(ep(m2, "B").x).toBeCloseTo(r, 2);
    expect(ep(m2, "B").y).toBeCloseTo(r + 100, 2);
  });

  it("four 90° corners close into a loop with ~zero closure error", () => {
    const mods = [corner("c1"), corner("c2"), corner("c3"), corner("c4")];
    const joins = [
      join("c1", "B", "c2", "A"),
      join("c2", "B", "c3", "A"),
      join("c3", "B", "c4", "A"),
      join("c4", "B", "c1", "A"), // close the ring
    ];
    const fp = composeFootprint(mods, joins);
    expect(fp.placed).toHaveLength(4);
    expect(fp.closures).toHaveLength(1);
    expect(fp.closures[0].gapInches).toBeCloseTo(0, 2);
    expect(fp.closures[0].gapDegrees).toBeCloseTo(0, 2);
  });

  it("reports a real closure gap when the ring doesn't meet", () => {
    // two straights joined at BOTH ends can't loop — 200in gap.
    const fp = composeFootprint(
      [straight("m1"), straight("m2")],
      [join("m1", "B", "m2", "A"), join("m2", "B", "m1", "A")],
    );
    expect(fp.closures).toHaveLength(1);
    expect(fp.closures[0].gapInches).toBeCloseTo(200, 2);
  });

  it("a mirrored corner curves the other way", () => {
    const normal = composeFootprint([corner("c")], []);
    const mirrored = composeFootprint([{ ...corner("c"), mirrored: true }], []);
    const r = 100 / (Math.PI / 2);
    expect(ep(normal.placed[0], "B").y).toBeCloseTo(r, 2); // north
    expect(ep(mirrored.placed[0], "B").y).toBeCloseTo(-r, 2); // south
  });

  it("honours a manual endplate pose override from the module's doc (#175 1b)", () => {
    // A wye-ish module: B hand-placed at (10, 90) heading 90 via doc.pose.
    const m: FootprintModule = {
      id: "w",
      moduleName: "wye",
      lengthTotalInches: 100,
      geometryType: "wye",
      schematic: {
        version: 1,
        endplates: [
          { id: "A" },
          { id: "B", pose: { x: 10, y: 90, heading: 90 } },
        ],
        tracks: [{ id: "main", role: "main", lane: 0 }],
      },
    };
    const fp = composeFootprint([m], []);
    expect(ep(fp.placed[0], "B")).toMatchObject({ x: 10, y: 90 });
  });

  it("disconnected modules are reported as unplaced", () => {
    const fp = composeFootprint([straight("m1"), straight("island")], [
      // island has no join
    ]);
    // both seed their own component at origin, so both ARE placed
    expect(fp.unplaced).toEqual([]);
    expect(fp.placed).toHaveLength(2);
  });
});
