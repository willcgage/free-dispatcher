/**
 * Module → Section mapping (#115) — the operations schematic colours and groups
 * by district; this resolves the finer unit a dispatcher actually *allocates*:
 * the Section. Like district mapping, a module's section is found by walking
 * district → section → block and matching blocks.moduleRecordNumber.
 *
 * Pure so it can be unit-tested; the schematic overlays the result as brackets.
 */

export interface SectionAwareDistrict {
  id: string;
  name: string;
  sections: {
    id: string;
    name: string;
    track?: string | null;
    blocks: { moduleRecordNumber: string | null }[];
  }[];
}

export interface ModuleSection {
  sectionId: string;
  sectionName: string;
  districtName: string;
  /** Optional parallel-main label (e.g. "Main 1"). */
  track: string | null;
}

/**
 * Map each module record number to the section that owns it (first by district
 * then section order when a module is linked more than once).
 */
export function moduleSectionMap(
  districts: SectionAwareDistrict[],
): Map<string, ModuleSection> {
  const map = new Map<string, ModuleSection>();
  for (const d of districts) {
    for (const s of d.sections) {
      for (const b of s.blocks) {
        const rec = b.moduleRecordNumber?.trim();
        if (rec && !map.has(rec)) {
          map.set(rec, {
            sectionId: s.id,
            sectionName: s.name,
            districtName: d.name,
            track: s.track ?? null,
          });
        }
      }
    }
  }
  return map;
}

export interface SectionSpan<T> {
  sectionId: string | null;
  sectionName: string | null;
  /** Indices of the contiguous run of items this span covers. */
  items: T[];
}

/**
 * Group a module sequence into contiguous runs that share a section, so the
 * schematic can draw one bracket per section. A run of modules with no section
 * (unassigned) becomes a span with sectionId null.
 */
export function sectionSpans<T>(
  items: T[],
  sectionOf: (item: T) => ModuleSection | undefined,
): SectionSpan<T>[] {
  const spans: SectionSpan<T>[] = [];
  for (const item of items) {
    const sec = sectionOf(item);
    const id = sec?.sectionId ?? null;
    const last = spans[spans.length - 1];
    if (last && last.sectionId === id) {
      last.items.push(item);
    } else {
      spans.push({
        sectionId: id,
        sectionName: sec?.sectionName ?? null,
        items: [item],
      });
    }
  }
  return spans;
}
