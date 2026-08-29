import { describe, it, expect } from "vitest";
import {
  moduleEndplates,
  implicitJoins,
  layoutJoins,
  joinStatus,
  joinKey,
  asJoins,
  type JoinSpine,
  type JoinPlacement,  endplateNeighbours,} from "../layoutJoins";

const mod = (
  id: string,
  positionIndex: number,
  endplates: { id: string; config?: "single" | "double" }[] = [
    { id: "A" },
    { id: "B" },
  ],
  flipped = false,
): JoinPlacement => ({
  id,
  positionIndex,
  moduleId: id,
  flipped,
  schematic: {
    version: 1,
    endplates: endplates.map((e) => ({
      id: e.id,
      tracks: [{ trackId: "main", lane: 0, config: e.config ?? "single" }],
    })),
    tracks: [{ id: "main", role: "main", lane: 0 }],
  },
});

describe("moduleEndplates", () => {
  it("reads endplate ids from the doc, defaulting to A/B", () => {
    expect(moduleEndplates(mod("p1", 0, [{ id: "A" }, { id: "B" }, { id: "C" }]))).toEqual(["A", "B", "C"]);
    expect(moduleEndplates({ id: "p9", schematic: null })).toEqual(["A", "B"]);
  });
});

describe("implicitJoins", () => {
  it("chains consecutive main-spine modules B→A", () => {
    const joins = implicitJoins([
      { branchId: null, modules: [mod("p1", 0), mod("p2", 1), mod("p3", 2)] },
    ]);
    expect(joins.map((j) => `${j.a.placementId}:${j.a.endplateId}-${j.b.placementId}:${j.b.endplateId}`)).toEqual([
      "p1:B-p2:A",
      "p2:B-p3:A",
    ]);
    expect(joins.every((j) => j.implicit)).toBe(true);
  });

  it("a reversed module mates its FACING endplates (turned end-for-end)", () => {
    // p2 reversed: its B faces west (toward p1), its A faces east (toward p3).
    const joins = implicitJoins([
      { branchId: null, modules: [mod("p1", 0), mod("p2", 1, undefined, true), mod("p3", 2)] },
    ]);
    expect(joins.map((j) => `${j.a.placementId}:${j.a.endplateId}-${j.b.placementId}:${j.b.endplateId}`)).toEqual([
      "p1:B-p2:B",
      "p2:A-p3:A",
    ]);
  });

  it("reversing resolves a single↔double endplate mismatch", () => {
    // p1 ends double at B; p2 is A=double, B=single. Facing p1 with A (double)
    // matches; reverse p2 → its B (single) faces p1 → still needs p1 single…
    // the useful case: p2 single end should face its single neighbour.
    const p1 = mod("p1", 0, [{ id: "A" }, { id: "B", config: "single" }]);
    const p2 = mod("p2", 1, [{ id: "A", config: "double" }, { id: "B", config: "single" }], true);
    const byId = new Map([["p1", p1], ["p2", p2]] as const);
    const [join] = implicitJoins([{ branchId: null, modules: [p1, p2] }]);
    // reversed p2 presents B (single) west → single↔single = ok
    expect(join.b.endplateId).toBe("B");
    expect(joinStatus(join, byId)).toBe("ok");
  });

  it("attaches a branch at its origin endplate ↔ the branch's first A", () => {
    const spines: JoinSpine[] = [
      { branchId: null, modules: [mod("p1", 0), mod("jct", 1, [{ id: "A" }, { id: "B" }, { id: "C" }])] },
      { branchId: "br", origin: { placementId: "jct", endplateId: "C" }, modules: [mod("b1", 0)] },
    ];
    const joins = implicitJoins(spines);
    expect(joins.some((j) => joinKey(j) === joinKey({ a: { placementId: "jct", endplateId: "C" }, b: { placementId: "b1", endplateId: "A" } }))).toBe(true);
  });
});

describe("layoutJoins", () => {
  const spines: JoinSpine[] = [
    { branchId: null, modules: [mod("p1", 0), mod("p2", 1)] },
  ];

  it("merges stored explicit joins and drops ones restating an implicit join", () => {
    const stored = [
      // circuit closure: p2's B back to p1's A — genuinely new
      { id: "x1", a: { placementId: "p2", endplateId: "B" }, b: { placementId: "p1", endplateId: "A" } },
      // restates the implicit p1:B-p2:A — dropped
      { id: "x2", a: { placementId: "p2", endplateId: "A" }, b: { placementId: "p1", endplateId: "B" } },
    ];
    const joins = layoutJoins(spines, stored);
    expect(joins).toHaveLength(2); // 1 implicit + 1 new explicit
    const explicit = joins.find((j) => !j.implicit)!;
    expect(joinKey(explicit)).toBe(joinKey({ a: { placementId: "p2", endplateId: "B" }, b: { placementId: "p1", endplateId: "A" } }));
  });
});

describe("endplateNeighbours (modulerepo#353 — name what is coupled)", () => {
  // A junction module on the main spine, with a branch hanging off its plate C.
  const spines: JoinSpine[] = [
    { branchId: null, modules: [mod("p1", 0), mod("p2", 1)] },
    {
      branchId: "b1",
      origin: { placementId: "p1", endplateId: "C" },
      modules: [mod("p9", 0)],
    },
  ];
  // ⭐ The record number and the human name are DIFFERENT here on purpose. The
  // first version of this test used a record number as the moduleName, so it
  // passed while the panel drew the long human name — the bug only showed up on
  // a real layout, where it rendered "C → ZZ Claude Test - drawn track across a
  // sectioned spine A".
  const placements = [
    { id: "p1", moduleId: "FMN-0012", moduleName: "Harrisonville" },
    { id: "p2", moduleId: "FMN-0035", moduleName: "EOL 2" },
    { id: "p9", moduleId: "FMN-0068", moduleName: "ZZ Claude Test - transition" },
  ];

  it("names what is over there, from BOTH sides of the join", () => {
    const n = endplateNeighbours(implicitJoins(spines), placements);
    // The junction's branch plate now has an answer — this is the whole point:
    // only the LAYOUT knows this, never the module.
    expect(n.get("p1:C")).toEqual({
      placementId: "p9",
      endplateId: "A",
      moduleId: "FMN-0068",
      moduleName: "ZZ Claude Test - transition",
    });
    // …and the branch's first module knows what it hangs off.
    expect(n.get("p9:A")).toEqual({
      placementId: "p1",
      endplateId: "C",
      moduleId: "FMN-0012",
      moduleName: "Harrisonville",
    });
    // The ordinary spine join is named too, both ways.
    expect(n.get("p1:B")?.moduleId).toBe("FMN-0035");
    expect(n.get("p2:A")?.moduleId).toBe("FMN-0012");
  });

  it("follows a FLIPPED placement to the end that actually faces the junction", () => {
    // ⭐ The rule lives in implicitJoins: a branch meets its first module's
    // WEST-facing end, which on a turned-around placement is B, not A. Naming
    // the neighbour must inherit that rather than assume "A".
    const flipped: JoinSpine[] = [
      { branchId: null, modules: [mod("p1", 0)] },
      {
        branchId: "b1",
        origin: { placementId: "p1", endplateId: "C" },
        modules: [{ ...mod("p9", 0), flipped: true }],
      },
    ];
    const n = endplateNeighbours(implicitJoins(flipped), placements);
    expect(n.get("p1:C")?.endplateId).toBe("B");
    expect(n.get("p9:B")?.endplateId).toBe("C");
    expect(n.get("p9:A")).toBeUndefined(); // its A faces the other way
  });

  it("says nothing about a plate with nothing coupled to it", () => {
    // The dispatcher falls back to the open-connector glyph here. An empty
    // arrow would be worse than no arrow.
    const n = endplateNeighbours(implicitJoins(spines), placements);
    expect(n.get("p2:C")).toBeUndefined();
    expect(n.get("p1:D")).toBeUndefined();
  });

  it("skips a join naming a placement the layout does not have", () => {
    // Rather than printing "C → ? A". A stale stored join must not become a
    // confident-looking label.
    const n = endplateNeighbours(
      [{ a: { placementId: "p1", endplateId: "C" }, b: { placementId: "gone", endplateId: "A" } }],
      placements,
    );
    expect(n.get("p1:C")).toBeUndefined();
  });
});

describe("joinStatus", () => {
  const byId = new Map(
    [
      mod("p1", 0, [{ id: "A" }, { id: "B", config: "double" }]),
      mod("p2", 1, [{ id: "A", config: "double" }, { id: "B" }]),
      mod("p3", 2, [{ id: "A" }, { id: "B" }]),
    ].map((m) => [m.id, m]),
  );

  it("ok when both endplates share a track config", () => {
    expect(joinStatus({ a: { placementId: "p1", endplateId: "B" }, b: { placementId: "p2", endplateId: "A" } }, byId)).toBe("ok"); // double-double
    expect(joinStatus({ a: { placementId: "p2", endplateId: "B" }, b: { placementId: "p3", endplateId: "A" } }, byId)).toBe("ok"); // single-single
  });

  it("mismatch across single↔double", () => {
    expect(joinStatus({ a: { placementId: "p1", endplateId: "B" }, b: { placementId: "p3", endplateId: "A" } }, byId)).toBe("mismatch"); // double-single
  });

  it("dangling when a placement or endplate is missing", () => {
    expect(joinStatus({ a: { placementId: "gone", endplateId: "B" }, b: { placementId: "p3", endplateId: "A" } }, byId)).toBe("dangling");
    expect(joinStatus({ a: { placementId: "p3", endplateId: "Z" }, b: { placementId: "p1", endplateId: "A" } }, byId)).toBe("dangling");
  });
});

describe("asJoins", () => {
  it("parses stored joins and tolerates junk", () => {
    expect(asJoins(null)).toEqual([]);
    expect(
      asJoins([
        { id: "j1", a: { placementId: "p1", endplateId: "B" }, b: { placementId: "p2", endplateId: "A" } },
        { a: { placementId: "p3", endplateId: "A" } }, // missing b → dropped
        "junk",
      ]),
    ).toEqual([
      { id: "j1", a: { placementId: "p1", endplateId: "B" }, b: { placementId: "p2", endplateId: "A" } },
    ]);
  });
});
