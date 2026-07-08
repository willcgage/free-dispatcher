import { describe, it, expect } from "vitest";
import {
  moduleEndplates,
  implicitJoins,
  layoutJoins,
  joinStatus,
  joinKey,
  asJoins,
  type JoinSpine,
  type JoinPlacement,
} from "../layoutJoins";

const mod = (
  id: string,
  positionIndex: number,
  endplates: { id: string; config?: "single" | "double" }[] = [
    { id: "A" },
    { id: "B" },
  ],
): JoinPlacement => ({
  id,
  positionIndex,
  moduleId: id,
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
