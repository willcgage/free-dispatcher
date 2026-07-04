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
    { id: "swW", pos: 6, onTrack: "main", divergeTrack: "sid", kind: "right", name: "West Siding" },
    { id: "swE", pos: 24, onTrack: "main", divergeTrack: "sid", kind: "left", name: "East Siding" },
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
