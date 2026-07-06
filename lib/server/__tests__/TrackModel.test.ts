import { describe, it, expect } from "vitest";
import { assertSingleDistrict, buildLayoutTree } from "../TrackModel";

describe("assertSingleDistrict (#80 route allocation bounding)", () => {
  it("returns the district when all sections share one", () => {
    const found = [
      { id: "s1", districtId: "d1" },
      { id: "s2", districtId: "d1" },
    ];
    expect(assertSingleDistrict(found, ["s1", "s2"])).toBe("d1");
  });

  it("throws when sections span more than one district", () => {
    const found = [
      { id: "s1", districtId: "d1" },
      { id: "s2", districtId: "d2" },
    ];
    expect(() => assertSingleDistrict(found, ["s1", "s2"])).toThrow(
      /one district/,
    );
  });

  it("throws when a requested section is missing", () => {
    const found = [{ id: "s1", districtId: "d1" }];
    expect(() => assertSingleDistrict(found, ["s1", "s2"])).toThrow(
      /do not exist/,
    );
  });
});

describe("buildLayoutTree (#80)", () => {
  const layout = {
    id: "L",
    name: "Test",
    description: null,
    standard: "freemon",
    controlPointDistricts: null,
    layoutControlPoints: null,
    branches: null,
    createdAt: new Date(),
  };

  it("nests sections/blocks under districts and sorts by position", () => {
    const tree = buildLayoutTree(
      layout,
      [
        { id: "d2", layoutId: "L", name: "South", position: 1, createdAt: new Date() },
        { id: "d1", layoutId: "L", name: "North", position: 0, createdAt: new Date() },
      ],
      [
        { id: "s1", districtId: "d1", name: "Sec B", track: null, position: 1, derivedKey: null, createdAt: new Date() },
        { id: "s0", districtId: "d1", name: "Sec A", track: null, position: 0, derivedKey: null, createdAt: new Date() },
      ],
      [
        { id: "b1", sectionId: "s0", name: "Blk 2", position: 1, moduleRecordNumber: null, createdAt: new Date() },
        { id: "b0", sectionId: "s0", name: "Blk 1", position: 0, moduleRecordNumber: null, createdAt: new Date() },
      ],
      [{ id: "t1", districtId: "d1", name: "Sw 1", createdAt: new Date() }],
    );

    // Districts sorted by position.
    expect(tree.districts.map((d) => d.name)).toEqual(["North", "South"]);
    // Sections under d1 sorted by position.
    expect(tree.districts[0].sections.map((s) => s.name)).toEqual(["Sec A", "Sec B"]);
    // Blocks under s0 sorted by position.
    expect(tree.districts[0].sections[0].blocks.map((b) => b.name)).toEqual([
      "Blk 1",
      "Blk 2",
    ]);
    // Turnouts nest under their district.
    expect(tree.districts[0].turnouts.map((t) => t.name)).toEqual(["Sw 1"]);
    // Empty district still renders with no sections or turnouts.
    expect(tree.districts[1].sections).toEqual([]);
    expect(tree.districts[1].turnouts).toEqual([]);
  });
});
