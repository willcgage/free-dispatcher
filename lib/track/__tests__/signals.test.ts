import { describe, it, expect } from "vitest";
import { deriveSectionAspect } from "../signals";

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
