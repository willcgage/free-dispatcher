import { describe, it, expect } from "vitest";
import { moduleMatches } from "../moduleSearch";
import type { CatalogModule } from "../types";

const mod: CatalogModule = {
  recordNumber: "FMN-0042",
  moduleName: "Columbia River Gorge",
  owner: "Alice Modeler",
  category: "scenic",
  geometryType: "straight",
  endplateCount: 2,
  hasMss: true,
};

describe("moduleMatches", () => {
  it("matches on name, record #, owner, category and geometry (case-insensitive)", () => {
    expect(moduleMatches(mod, "columbia")).toBe(true);
    expect(moduleMatches(mod, "fmn-0042")).toBe(true);
    expect(moduleMatches(mod, "alice")).toBe(true);
    expect(moduleMatches(mod, "SCENIC")).toBe(true);
    expect(moduleMatches(mod, "straight")).toBe(true);
  });

  it("returns true for an empty query and false for no match", () => {
    expect(moduleMatches(mod, "   ")).toBe(true);
    expect(moduleMatches(mod, "yardmaster")).toBe(false);
  });

  it("tolerates null fields", () => {
    const bare = { ...mod, category: null, geometryType: null };
    expect(moduleMatches(bare, "gorge")).toBe(true);
    expect(moduleMatches(bare, "scenic")).toBe(false);
  });
});
