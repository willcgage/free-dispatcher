/**
 * District colouring (#115, phase 4) — paint the schematic by dispatcher
 * territory. A district owns sections, which hold blocks, and a block may map to
 * a module (blocks.moduleRecordNumber). So a module's district is derived by
 * walking district → section → block and matching the module's record number.
 *
 * Pure so it can be unit-tested; the schematic just reads the map + palette.
 */

export interface DistrictLite {
  id: string;
  name: string;
  sections: { blocks: { moduleRecordNumber: string | null }[] }[];
}

export interface ModuleDistrict {
  districtId: string;
  name: string;
  /** Index of the district in the layout, used to pick a stable colour. */
  index: number;
}

/**
 * Distinct, readable-on-dark palette for district territories. Indexed by the
 * district's position in the layout; wraps if there are more districts than
 * colours.
 */
export const DISTRICT_COLORS = [
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb7185", // rose
  "#fbbf24", // amber
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a3e635", // lime
] as const;

export function districtColor(index: number): string {
  return DISTRICT_COLORS[index % DISTRICT_COLORS.length];
}

/**
 * Map each module record number to the district that owns it (via a block
 * link). A module linked from more than one district takes the first by district
 * order — an authoring ambiguity the caller can surface separately.
 */
export function moduleDistrictMap(
  districts: DistrictLite[],
): Map<string, ModuleDistrict> {
  const map = new Map<string, ModuleDistrict>();
  districts.forEach((d, index) => {
    for (const s of d.sections) {
      for (const b of s.blocks) {
        const rec = b.moduleRecordNumber?.trim();
        if (rec && !map.has(rec)) {
          map.set(rec, { districtId: d.id, name: d.name, index });
        }
      }
    }
  });
  return map;
}

/** Districts that actually own at least one module, with their colour. */
export function districtLegend(
  districts: DistrictLite[],
): { id: string; name: string; color: string }[] {
  const map = moduleDistrictMap(districts);
  const usedIds = new Set([...map.values()].map((v) => v.districtId));
  return districts
    .map((d, index) => ({ id: d.id, name: d.name, color: districtColor(index) }))
    .filter((d) => usedIds.has(d.id));
}
