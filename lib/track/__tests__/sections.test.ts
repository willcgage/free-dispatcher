import { describe, it, expect } from "vitest";
import {
  moduleSectionMap,
  sectionSpans,
  type SectionAwareDistrict,
} from "../sections";

const district = (
  id: string,
  name: string,
  sections: { id: string; name: string; track?: string | null; mods: (string | null)[] }[],
): SectionAwareDistrict => ({
  id,
  name,
  sections: sections.map((s) => ({
    id: s.id,
    name: s.name,
    track: s.track ?? null,
    blocks: s.mods.map((moduleRecordNumber) => ({ moduleRecordNumber })),
  })),
});

describe("moduleSectionMap", () => {
  it("maps a module to the section whose block links it", () => {
    const map = moduleSectionMap([
      district("d1", "North", [
        { id: "s1", name: "Sec A", track: "Main 1", mods: ["FMN-0001"] },
        { id: "s2", name: "Sec B", mods: ["FMN-0002"] },
      ]),
    ]);
    expect(map.get("FMN-0001")).toMatchObject({
      sectionId: "s1",
      sectionName: "Sec A",
      districtName: "North",
      track: "Main 1",
    });
    expect(map.get("FMN-0002")?.sectionName).toBe("Sec B");
    expect(map.has("FMN-9999")).toBe(false);
  });

  it("keeps the first section when a module is linked twice", () => {
    const map = moduleSectionMap([
      district("d1", "North", [
        { id: "s1", name: "Sec A", mods: ["FMN-0001"] },
        { id: "s2", name: "Sec B", mods: ["FMN-0001"] },
      ]),
    ]);
    expect(map.get("FMN-0001")?.sectionId).toBe("s1");
  });
});

describe("sectionSpans", () => {
  const map = moduleSectionMap([
    district("d1", "North", [
      { id: "s1", name: "Sec A", mods: ["a", "b"] },
      { id: "s2", name: "Sec B", mods: ["d"] },
    ]),
  ]);
  const sectionOf = (rec: string) => map.get(rec);

  it("groups contiguous modules of the same section and breaks on change/gap", () => {
    const spans = sectionSpans(["a", "b", "c", "d"], sectionOf);
    expect(spans.map((s) => [s.sectionName, s.items])).toEqual([
      ["Sec A", ["a", "b"]],
      [null, ["c"]], // unassigned
      ["Sec B", ["d"]],
    ]);
  });

  it("splits a repeated section that is not contiguous into separate spans", () => {
    // a(SecA) c(unassigned) b(SecA) → two SecA spans, not merged across the gap.
    const spans = sectionSpans(["a", "c", "b"], sectionOf);
    expect(spans.map((s) => s.sectionName)).toEqual(["Sec A", null, "Sec A"]);
  });

  it("returns an empty list for no items", () => {
    expect(sectionSpans([], sectionOf)).toEqual([]);
  });
});
