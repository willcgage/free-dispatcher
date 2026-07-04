import { describe, it, expect } from "vitest";
import {
  districtColor,
  districtLegend,
  moduleDistrictMap,
  DISTRICT_COLORS,
  type DistrictLite,
} from "../districts";

const d = (
  id: string,
  name: string,
  ...mods: (string | null)[]
): DistrictLite => ({
  id,
  name,
  sections: [{ blocks: mods.map((moduleRecordNumber) => ({ moduleRecordNumber })) }],
});

describe("moduleDistrictMap", () => {
  it("maps a module to the district whose block links it", () => {
    const map = moduleDistrictMap([
      d("d1", "North", "FMN-0001", "FMN-0002"),
      d("d2", "South", "FMN-0003"),
    ]);
    expect(map.get("FMN-0001")).toMatchObject({ districtId: "d1", name: "North", index: 0 });
    expect(map.get("FMN-0003")).toMatchObject({ districtId: "d2", index: 1 });
    expect(map.has("FMN-9999")).toBe(false);
  });

  it("ignores blank/null block links", () => {
    const map = moduleDistrictMap([d("d1", "North", null, "  ", "FMN-0001")]);
    expect(map.size).toBe(1);
    expect(map.has("FMN-0001")).toBe(true);
  });

  it("keeps the first district when a module is linked from two", () => {
    const map = moduleDistrictMap([
      d("d1", "North", "FMN-0001"),
      d("d2", "South", "FMN-0001"),
    ]);
    expect(map.get("FMN-0001")?.districtId).toBe("d1");
  });
});

describe("districtColor", () => {
  it("is stable by index and wraps past the palette", () => {
    expect(districtColor(0)).toBe(DISTRICT_COLORS[0]);
    expect(districtColor(DISTRICT_COLORS.length)).toBe(DISTRICT_COLORS[0]);
  });
});

describe("districtLegend", () => {
  it("lists only districts that own a module, with their colour", () => {
    const legend = districtLegend([
      d("d1", "North", "FMN-0001"),
      d("d2", "South", null), // owns nothing
      d("d3", "East", "FMN-0002"),
    ]);
    expect(legend).toEqual([
      { id: "d1", name: "North", color: DISTRICT_COLORS[0] },
      { id: "d3", name: "East", color: DISTRICT_COLORS[2] },
    ]);
  });
});
