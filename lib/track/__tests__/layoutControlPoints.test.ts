import { describe, it, expect } from "vitest";
import {
  layoutControlPoints,
  deriveSections,
  type CpModuleInput,
} from "../layoutControlPoints";

const mod = (
  moduleId: string,
  positionIndex: number,
  cps: { id: string; name?: string }[],
): CpModuleInput => ({
  moduleId,
  moduleName: moduleId,
  positionIndex,
  schematic: {
    version: 1,
    lengthInches: 96,
    endplates: [],
    tracks: [{ id: "main", role: "main", lane: 0 }],
    controlPoints: cps.map((c) => ({ id: c.id, name: c.name, turnouts: [], signals: [] })),
  },
});

describe("layoutControlPoints", () => {
  it("enumerates control points across modules in spine order", () => {
    const cps = layoutControlPoints([
      mod("FMN-0002", 1, [{ id: "cpC", name: "C" }]),
      mod("FMN-0001", 0, [{ id: "cpA", name: "A" }, { id: "cpB", name: "B" }]),
    ]);
    expect(cps.map((c) => c.key)).toEqual([
      "FMN-0001:cpA",
      "FMN-0001:cpB",
      "FMN-0002:cpC",
    ]);
    expect(cps[0]).toMatchObject({ moduleId: "FMN-0001", cpId: "cpA", name: "A" });
  });

  it("skips modules without a schematic and falls back to the cp id for a name", () => {
    const cps = layoutControlPoints([
      { moduleId: "FMN-9", positionIndex: 0, schematic: null },
      mod("FMN-0001", 1, [{ id: "cpX" }]),
    ]);
    expect(cps).toHaveLength(1);
    expect(cps[0].name).toBe("cpX");
  });
});

describe("deriveSections", () => {
  const cps = layoutControlPoints([
    mod("FMN-0001", 0, [{ id: "a", name: "A" }, { id: "b", name: "B" }]),
    mod("FMN-0002", 1, [{ id: "c", name: "C" }]),
  ]);

  it("makes a section between adjacent control points sharing a district", () => {
    const sections = deriveSections(cps, {
      "FMN-0001:a": "d1",
      "FMN-0001:b": "d1",
      "FMN-0002:c": "d2",
    });
    // A–B share d1 → one section; B–C differ (d1 vs d2) → boundary, no section.
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ districtId: "d1", name: "A – B" });
  });

  it("makes no section across a district boundary or an unassigned point", () => {
    expect(deriveSections(cps, { "FMN-0001:a": "d1" })).toEqual([]);
    expect(
      deriveSections(cps, { "FMN-0001:a": "d1", "FMN-0001:b": "d2" }),
    ).toEqual([]);
  });
});
