import { describe, it, expect } from "vitest";
import {
  asModuleSchematic,
  moduleFeatures,
  type ModuleSchematicDoc,
} from "../moduleSchematic";

const doc: ModuleSchematicDoc = {
  version: 1,
  module: "FMN-0003",
  lengthInches: 30,
  endplates: [
    { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
    { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
  ],
  tracks: [
    { id: "main", role: "main", lane: 0, from: "A", to: "B" },
    { id: "sid", role: "siding", lane: 1, from: "swW", to: "swE", fromPos: 6, toPos: 24 },
    { id: "spur", role: "spur", lane: 2, from: "swW", to: "spurEnd", fromPos: 6, toPos: 15 },
  ],
  turnouts: [
    // Siding above the main: west turnout throws left, east throws right (both
    // resolve to the "above" side — the hand drives the drawn side, 0.13.0+).
    { id: "swW", pos: 6, onTrack: "main", divergeTrack: "sid", kind: "left", name: "West Siding" },
    { id: "swE", pos: 24, onTrack: "main", divergeTrack: "sid", kind: "right", name: "East Siding" },
  ],
  signals: [{ id: "sW", pos: 3, track: "main", facing: "AtoB", name: "CP West" }],
};

describe("asModuleSchematic", () => {
  it("accepts a well-formed doc and rejects junk", () => {
    expect(asModuleSchematic(doc)).not.toBeNull();
    expect(asModuleSchematic(null)).toBeNull();
    expect(asModuleSchematic({})).toBeNull();
    expect(asModuleSchematic({ version: 1 })).toBeNull(); // no endplates/tracks
    expect(asModuleSchematic({ version: "x", endplates: [], tracks: [] })).toBeNull();
  });
});

describe("moduleFeatures", () => {
  const f = moduleFeatures(doc);

  it("excludes the main track and keeps sidings/spurs as extra tracks", () => {
    expect(f.extraTracks.map((t) => t.id)).toEqual(["sid", "spur"]);
  });

  it("normalises positions to fractions of the module length", () => {
    const sid = f.extraTracks.find((t) => t.id === "sid")!;
    expect(sid.fromFrac).toBeCloseTo(6 / 30);
    expect(sid.toFrac).toBeCloseTo(24 / 30);
    expect(sid.lane).toBe(1);
  });

  it("places turnouts at their pos with on/diverge lanes resolved", () => {
    const swW = f.turnouts.find((t) => t.id === "swW")!;
    expect(swW.posFrac).toBeCloseTo(6 / 30);
    expect(swW.onLane).toBe(0); // main
    expect(swW.divergeLane).toBe(1); // siding
  });

  it("places signals at their pos on the governed track's lane", () => {
    expect(f.signals[0]).toMatchObject({ posFrac: 0.1, lane: 0, facing: "AtoB" });
  });

  it("positions features by their true proportion, distinct near an end", () => {
    // One Mile: 432\" module. Two control-point signals 6\" and 14\" from the West
    // end must render at DIFFERENT spots (not bunched at an inset boundary).
    const oneMile: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 432,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "sid", role: "siding", lane: 1, from: "swW", to: "swE", fromPos: 12, toPos: 420 },
      ],
      turnouts: [
        { id: "swW", pos: 12, onTrack: "main", divergeTrack: "sid", kind: "right" },
      ],
      controlPoints: [
        {
          id: "cp1",
          name: "West",
          turnouts: ["swW"],
          signals: [
            { id: "a", pos: 6, track: "main", facing: "AtoB" },
            { id: "b", pos: 14, track: "sid", facing: "BtoA" },
          ],
        },
      ],
    };
    const feat = moduleFeatures(oneMile);
    expect(feat.turnouts[0].posFrac).toBeCloseTo(12 / 432);
    expect(feat.signals[0].posFrac).toBeCloseTo(6 / 432);
    expect(feat.signals[1].posFrac).toBeCloseTo(14 / 432);
    expect(feat.signals[0].posFrac).not.toBeCloseTo(feat.signals[1].posFrac);
  });

  it("flattens control-point groups into signals (both directions per CP)", () => {
    const withCps: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 96,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [{ id: "main", role: "main", lane: 0, from: "A", to: "B" }],
      controlPoints: [
        {
          id: "cp1",
          name: "West Siding",
          turnouts: ["sw1"],
          signals: [
            { id: "cp1-AtoB", pos: 18, track: "main", facing: "AtoB" },
            { id: "cp1-BtoA", pos: 18, track: "main", facing: "BtoA" },
          ],
        },
      ],
    };
    const feat = moduleFeatures(withCps);
    expect(feat.signals).toHaveLength(2);
    expect(feat.signals.every((s) => s.name === "West Siding")).toBe(true);
    expect(feat.signals.map((s) => s.facing).sort()).toEqual(["AtoB", "BtoA"]);
  });

  it("skips a track whose endpoints can't be resolved", () => {
    const bad: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 30,
      endplates: [{ id: "A" }, { id: "B" }],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "orphan", role: "spur", lane: 1, from: "ghost", to: "nowhere" },
      ],
    };
    expect(moduleFeatures(bad).extraTracks).toHaveLength(0);
  });
});
