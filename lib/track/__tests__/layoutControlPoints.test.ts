import { describe, it, expect } from "vitest";
import {
  layoutControlPoints,
  deriveSections,
  asLayoutCps,
  type CpModuleInput,
  type LayoutCp,
} from "../layoutControlPoints";

const mod = (
  moduleId: string,
  positionIndex: number,
  cps: { id: string; name?: string; pos?: number }[],
  placementId?: string,
): CpModuleInput => ({
  id: placementId ?? `pl-${moduleId}`,
  moduleId,
  moduleName: moduleId,
  positionIndex,
  schematic: {
    version: 1,
    lengthInches: 96,
    endplates: [],
    tracks: [{ id: "main", role: "main", lane: 0 }],
    controlPoints: cps.map((c) => ({
      id: c.id,
      name: c.name,
      turnouts: [],
      signals:
        c.pos != null
          ? [{ id: `${c.id}-s`, pos: c.pos, track: "main", facing: "AtoB" }]
          : [],
    })),
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
    expect(cps[0]).toMatchObject({
      moduleId: "FMN-0001",
      cpId: "cpA",
      name: "A",
      source: "module",
    });
  });

  it("orders points within a module by schematic position", () => {
    const cps = layoutControlPoints([
      mod("FMN-0001", 0, [
        { id: "east", name: "East", pos: 350 },
        { id: "west", name: "West", pos: 40 },
      ]),
    ]);
    expect(cps.map((c) => c.cpId)).toEqual(["west", "east"]);
    expect(cps[0].posInches).toBe(40);
  });

  it("skips modules without a schematic and falls back to the cp id for a name", () => {
    const cps = layoutControlPoints([
      { moduleId: "FMN-9", positionIndex: 0, schematic: null },
      mod("FMN-0001", 1, [{ id: "cpX" }]),
    ]);
    expect(cps).toHaveLength(1);
    expect(cps[0].name).toBe("cpX");
  });

  it("interleaves layout-level points by anchored offset (#144)", () => {
    const modules = [
      mod("FMN-0001", 0, [
        { id: "west", name: "West", pos: 40 },
        { id: "east", name: "East", pos: 350 },
      ]),
    ];
    const layoutCps: LayoutCp[] = [
      { id: "x1", name: "Midway", anchor: "pl-FMN-0001", offsetInches: 200 },
    ];
    const cps = layoutControlPoints(modules, layoutCps);
    expect(cps.map((c) => c.name)).toEqual(["West", "Midway", "East"]);
    expect(cps[1]).toMatchObject({
      key: "layout:x1",
      source: "layout",
      posInches: 200,
      moduleId: "FMN-0001",
    });
  });

  it("drops layout-level points whose anchor placement is gone", () => {
    const cps = layoutControlPoints(
      [mod("FMN-0001", 0, [{ id: "a", name: "A" }])],
      [{ id: "x1", name: "Orphan", anchor: "pl-REMOVED", offsetInches: 10 }],
    );
    expect(cps.map((c) => c.name)).toEqual(["A"]);
  });

  it("a layout-level point can stand alone on a CP-less module", () => {
    const cps = layoutControlPoints(
      [mod("FMN-0001", 0, []), mod("FMN-0002", 1, [{ id: "b", name: "B", pos: 10 }])],
      [{ id: "x1", name: "Junction", anchor: "pl-FMN-0001", offsetInches: 48 }],
    );
    expect(cps.map((c) => c.name)).toEqual(["Junction", "B"]);
  });
});

describe("deriveSections", () => {
  const cps = layoutControlPoints([
    mod("FMN-0001", 0, [{ id: "a", name: "A", pos: 10 }, { id: "b", name: "B", pos: 80 }]),
    mod("FMN-0002", 1, [{ id: "c", name: "C", pos: 10 }]),
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

  it("layout-level points participate in section derivation (#144)", () => {
    const merged = layoutControlPoints(
      [mod("FMN-0001", 0, [{ id: "a", name: "A", pos: 10 }, { id: "b", name: "B", pos: 90 }])],
      [{ id: "x1", name: "Mid", anchor: "pl-FMN-0001", offsetInches: 50 }],
    );
    const sections = deriveSections(merged, {
      "FMN-0001:a": "d1",
      "layout:x1": "d1",
      "FMN-0001:b": "d1",
    });
    expect(sections.map((s) => s.name)).toEqual(["A – Mid", "Mid – B"]);
  });
});

describe("asLayoutCps", () => {
  it("parses a stored array and tolerates junk", () => {
    expect(asLayoutCps(null)).toEqual([]);
    expect(asLayoutCps("nope")).toEqual([]);
    expect(
      asLayoutCps([
        { id: "x1", name: "Mid", anchor: "pl-1", offsetInches: 50 },
        { id: 5, anchor: "pl-1" }, // bad id → dropped
        "junk",
        { id: "x2", anchor: "pl-2" }, // defaults
      ]),
    ).toEqual([
      { id: "x1", name: "Mid", anchor: "pl-1", offsetInches: 50 },
      { id: "x2", name: "x2", anchor: "pl-2", offsetInches: 0 },
    ]);
  });
});
