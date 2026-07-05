import { describe, it, expect } from "vitest";
import {
  layoutControlPoints,
  deriveSections,
  asLayoutCps,
  planSectionSync,
  planBlockSync,
  DERIVED_POSITION_BASE,
  type CpModuleInput,
  type LayoutCp,
  type DerivedSection,
  type ExistingSectionRow,
  type ExistingBlockRow,
  type SpannedModule,
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

describe("deriveSections module span (#148)", () => {
  it("spans every module between the two control points, including CP-less ones", () => {
    const modules = [
      mod("FMN-0001", 0, [{ id: "a", name: "A", pos: 90 }]),
      mod("FMN-0002", 1, []), // no control points — still part of the span
      mod("FMN-0003", 2, [{ id: "b", name: "B", pos: 10 }]),
    ];
    const cps = layoutControlPoints(modules);
    const sections = deriveSections(cps, { "FMN-0001:a": "d1", "FMN-0003:b": "d1" }, modules);
    expect(sections).toHaveLength(1);
    expect(sections[0].moduleSpan?.map((m) => m.moduleId)).toEqual([
      "FMN-0001",
      "FMN-0002",
      "FMN-0003",
    ]);
  });

  it("a section within one module spans just that module; span omitted without modules", () => {
    const modules = [
      mod("FMN-0001", 0, [{ id: "a", name: "A", pos: 10 }, { id: "b", name: "B", pos: 90 }]),
    ];
    const cps = layoutControlPoints(modules);
    const assign = { "FMN-0001:a": "d1", "FMN-0001:b": "d1" };
    expect(deriveSections(cps, assign, modules)[0].moduleSpan?.map((m) => m.moduleId)).toEqual([
      "FMN-0001",
    ]);
    expect(deriveSections(cps, assign)[0].moduleSpan).toBeUndefined();
  });
});

describe("planBlockSync (#148)", () => {
  const span: SpannedModule[] = [
    { moduleId: "FMN-0001", moduleName: "One Mile" },
    { moduleId: "FMN-0002", moduleName: null },
  ];
  const blk = (
    id: string,
    sectionId: string,
    name: string,
    position: number,
    moduleRecordNumber: string,
  ): ExistingBlockRow => ({ id, sectionId, name, position, moduleRecordNumber });

  it("creates one block per spanned module, named after the module", () => {
    const plan = planBlockSync([], new Map([["s1", span]]));
    expect(plan.remove).toEqual([]);
    expect(plan.insert).toEqual([
      { sectionId: "s1", name: "One Mile", position: 0, moduleRecordNumber: "FMN-0001" },
      { sectionId: "s1", name: "FMN-0002", position: 1, moduleRecordNumber: "FMN-0002" },
    ]);
  });

  it("is a no-op when blocks already match", () => {
    const existing = [
      blk("b1", "s1", "One Mile", 0, "FMN-0001"),
      blk("b2", "s1", "FMN-0002", 1, "FMN-0002"),
    ];
    expect(planBlockSync(existing, new Map([["s1", span]]))).toEqual({
      insert: [],
      remove: [],
    });
  });

  it("replaces a section's blocks when the span changes, and clears orphans", () => {
    const existing = [
      blk("b1", "s1", "One Mile", 0, "FMN-0001"),
      blk("b9", "sGone", "Old", 0, "FMN-0009"),
    ];
    const plan = planBlockSync(existing, new Map([["s1", span]]));
    expect(plan.remove.sort()).toEqual(["b1", "b9"]);
    expect(plan.insert).toHaveLength(2);
  });
});

describe("planSectionSync (#146)", () => {
  const derived: DerivedSection[] = [
    { districtId: "d1", fromKey: "M:a", toKey: "M:b", name: "A – B" },
    { districtId: "d1", fromKey: "M:b", toKey: "M:c", name: "B – C" },
  ];
  const valid = new Set(["d1"]);
  const row = (
    id: string,
    derivedKey: string | null,
    over: Partial<ExistingSectionRow> = {},
  ): ExistingSectionRow => ({
    id,
    districtId: "d1",
    name: "A – B",
    position: DERIVED_POSITION_BASE,
    derivedKey,
    ...over,
  });

  it("inserts everything on first sync, positioned after hand-authored rows", () => {
    const plan = planSectionSync([row("hand", null)], derived, valid);
    expect(plan.remove).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.insert).toEqual([
      { districtId: "d1", name: "A – B", position: DERIVED_POSITION_BASE, derivedKey: "M:a→M:b" },
      { districtId: "d1", name: "B – C", position: DERIVED_POSITION_BASE + 1, derivedKey: "M:b→M:c" },
    ]);
  });

  it("is a no-op when rows already match, and never touches hand-authored rows", () => {
    const existing = [
      row("hand", null, { name: "Yard lead", position: 0 }),
      row("x1", "M:a→M:b"),
      row("x2", "M:b→M:c", { name: "B – C", position: DERIVED_POSITION_BASE + 1 }),
    ];
    const plan = planSectionSync(existing, derived, valid);
    expect(plan).toEqual({ insert: [], update: [], remove: [] });
  });

  it("renames/moves changed rows and removes stale ones", () => {
    const existing = [
      row("x1", "M:a→M:b", { name: "Old name" }), // renamed CP
      row("gone", "M:c→M:d"), // no longer derived
    ];
    const plan = planSectionSync(existing, derived, valid);
    expect(plan.update).toEqual([
      { id: "x1", districtId: "d1", name: "A – B", position: DERIVED_POSITION_BASE },
    ]);
    expect(plan.remove).toEqual(["gone"]);
    expect(plan.insert.map((i) => i.derivedKey)).toEqual(["M:b→M:c"]);
  });

  it("skips sections for districts that no longer exist", () => {
    const plan = planSectionSync([], derived, new Set<string>());
    expect(plan.insert).toEqual([]);
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
