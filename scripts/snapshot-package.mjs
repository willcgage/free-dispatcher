/**
 * Snapshot what the package hands FD, over the REAL catalogue, so a version bump
 * can be diffed instead of hoped about.
 *
 * The 0.71 → 0.147 jump changed the result for every one of 37 modules while
 * `tsc` and 176 tests reported no difference — because nothing fed a real
 * document through the package and looked at the numbers that reach the
 * dispatcher. This does.
 *
 *   node scripts/snapshot-package.mjs > scripts/snap-<version>.json
 *
 * ⚠️ Classify ADDED vs CHANGED separately when diffing. Last time a single NEW
 * FIELD made "37/37 changed" out of a handful of real differences.
 */
import { readFileSync } from "node:fs";
import { moduleFootprint, deriveEndplatePoses } from "@willcgage/module-schematic";

const version = JSON.parse(
  readFileSync("node_modules/@willcgage/module-schematic/package.json", "utf8"),
).version;
const corpus = JSON.parse(readFileSync("scripts/corpus.json", "utf8"));

const r = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const bbox = (pts) => {
  if (!pts || !pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return [r(Math.min(...xs)), r(Math.min(...ys)), r(Math.max(...xs)), r(Math.max(...ys))];
};
const pt = (p) => (p ? [r(p.x), r(p.y)] : null);

const out = { version, modules: {} };
for (const m of corpus) {
  // The same shape FD's own `poseInput` builds — endplate configs, widths and
  // offsets read off the document, the rest off the record.
  const plates = m.endplates ?? [];
  const cfg = (id) => plates.find((e) => e.id === id)?.tracks?.[0]?.config ?? undefined;
  const widths = {};
  const offsets = {};
  for (const e of plates) {
    if (typeof e.widthInches === "number") widths[e.id] = e.widthInches;
    if (typeof e.trackOffsetInches === "number") offsets[e.id] = e.trackOffsetInches;
  }
  const input = {
    lengthInches: m.L,
    geometryType: m.g,
    geometryDegrees: m.gd,
    geometryOffsetInches: m.go,
    endplateConfigs: [cfg("A"), cfg("B")],
    endplateWidths: widths,
    endplateTrackOffsets: offsets,
    mainsSwapped: m.swapped,
    outline: m.outline,
    sections: m.sections,
    mainPath: m.mainPath,
  };
  let rec;
  try {
    const fp = moduleFootprint(input);
    const poses = deriveEndplatePoses(input);
    rec = {
      // what FD DRAWS
      band: bbox(fp.band),
      outline: bbox(fp.outline),
      faces: (fp.endplateFaces ?? []).map((f) => [pt(f.p1), pt(f.p2), pt(f.mid)]),
      // what FD PLACES BY
      poses: poses.map((p) => [p.id, r(p.x), r(p.y), r(p.heading), p.trackConfig,
        (p.trackOffsets ?? []).map(r).join("/")]),
      // the spine itself
      spineN: fp.centerline?.length ?? 0,
      spineEnd: pt(fp.centerline?.[(fp.centerline?.length ?? 1) - 1]),
      // sections, which FD does NOT draw — kept so the diff can prove that
      sectionOutlines: (fp.sectionOutlines ?? []).map((s) => [s.id, bbox(s.outline)]),
      // every key the footprint hands back, so an ADDED one is visible as ADDED
      keys: Object.keys(fp).sort().join(","),
    };
  } catch (e) {
    rec = { error: String(e && e.message ? e.message : e) };
  }
  out.modules[m.id] = rec;
}
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
