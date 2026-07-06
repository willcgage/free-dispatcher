import { describe, it, expect } from "vitest";
import { deriveSectionAspect, cpSignalAspects } from "../signals";
import type { ControlPointRef } from "../layoutControlPoints";

describe("deriveSectionAspect (#83 virtual signals)", () => {
  it("is occupied when any block is occupied — regardless of allocation", () => {
    const occ = new Set(["b2"]);
    expect(deriveSectionAspect(["b1", "b2"], occ, false)).toBe("occupied");
    // occupancy wins over allocation
    expect(deriveSectionAspect(["b1", "b2"], occ, true)).toBe("occupied");
  });

  it("is allocated when held but not occupied", () => {
    expect(deriveSectionAspect(["b1"], new Set(), true)).toBe("allocated");
  });

  it("is clear when free and unallocated", () => {
    expect(deriveSectionAspect(["b1"], new Set(), false)).toBe("clear");
  });

  it("treats an empty block list by allocation only", () => {
    expect(deriveSectionAspect([], new Set(), true)).toBe("allocated");
    expect(deriveSectionAspect([], new Set(), false)).toBe("clear");
  });
});

describe("cpSignalAspects (#151 live CTC panel)", () => {
  const cp = (key: string): ControlPointRef => ({
    key,
    moduleId: key.split(":")[0],
    moduleName: null,
    cpId: key.split(":")[1] ?? key,
    name: key,
    source: "module",
    posInches: null,
    spineId: null,
  });
  // West — Mid — East along the spine; one derived section each side of Mid.
  const cps = [cp("M:west"), cp("M:mid"), cp("M:east")];
  const sections = new Map([
    ["M:west→M:mid", "s1"],
    ["M:mid→M:east", "s2"],
  ]);

  it("defaults every signal to stop (absolute signals)", () => {
    const a = cpSignalAspects(cps, sections, {}, new Set());
    expect(a["M:west"]).toEqual({ AtoB: "stop", BtoA: "stop" });
    expect(a["M:mid"]).toEqual({ AtoB: "stop", BtoA: "stop" });
  });

  it("clears the entrance signal in the allocated direction only", () => {
    const a = cpSignalAspects(
      cps,
      sections,
      { s1: { direction: "AtoB" } },
      new Set(),
    );
    // Eastward authority into s1: west's A→B clears; nothing else does.
    expect(a["M:west"].AtoB).toBe("clear");
    expect(a["M:west"].BtoA).toBe("stop");
    expect(a["M:mid"]).toEqual({ AtoB: "stop", BtoA: "stop" });
  });

  it("a westward allocation clears the far-end signal instead", () => {
    const a = cpSignalAspects(
      cps,
      sections,
      { s2: { direction: "BtoA" } },
      new Set(),
    );
    // Westward authority into s2: east's B→A clears.
    expect(a["M:east"].BtoA).toBe("clear");
    expect(a["M:mid"].AtoB).toBe("stop");
  });

  it("an occupied section holds its signals at stop even when allocated", () => {
    const a = cpSignalAspects(
      cps,
      sections,
      { s1: { direction: "AtoB" } },
      new Set(["s1"]),
    );
    expect(a["M:west"].AtoB).toBe("stop");
  });

  it("gaps without a materialized section stay at stop", () => {
    const a = cpSignalAspects(cps, new Map(), { s1: { direction: "AtoB" } }, new Set());
    expect(a["M:west"].AtoB).toBe("stop");
  });
});
