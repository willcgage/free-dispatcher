import { describe, it, expect } from "vitest";
import { moduleFeatures, type ModuleSchematicDoc } from "../moduleSchematic";
import { reverseModuleFeatures } from "../reverseFeatures";

describe("reverseModuleFeatures", () => {
  it("mirrors along-module positions west↔east and flips signal facing", () => {
    const doc: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 100,
      endplates: [{ id: "A" }, { id: "B" }],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "sp", role: "spur", lane: 1, fromPos: 20, toPos: 50 },
      ],
      turnouts: [{ id: "sw", pos: 20, onTrack: "main", divergeTrack: "sp", kind: "left" }],
      controlPoints: [
        {
          id: "cp",
          name: "West",
          turnouts: ["sw"],
          signals: [{ id: "s1", pos: 10, track: "main", facing: "AtoB", side: "above" }],
        },
      ],
    };
    const f = moduleFeatures(doc);
    const r = reverseModuleFeatures(f);

    const sp = r.extraTracks[0];
    // spur 0.2–0.5 mirrors to 0.5–0.8, throat (was at the turnout, west end 0.2)
    // moves to the east end 0.8.
    expect(sp.fromFrac).toBeCloseTo(0.5);
    expect(sp.toFrac).toBeCloseTo(0.8);
    expect(sp.throatFrac).toBeCloseTo(0.8);
    expect(sp.lane).toBe(1); // lane (N/S) unchanged

    expect(r.turnouts[0].posFrac).toBeCloseTo(0.8);
    expect(r.signals[0].posFrac).toBeCloseTo(0.9);
    expect(r.signals[0].facing).toBe("BtoA"); // flipped
    expect(r.signals[0].side).toBe("above"); // side unchanged
  });

  it("mirrors an industry's span west↔east (lane/side unchanged)", () => {
    const doc: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 100,
      endplates: [{ id: "A" }, { id: "B" }],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "sp", role: "spur", lane: 1, fromPos: 10, toPos: 60 },
      ],
      industries: [
        { id: "i1", name: "Ace Feed", track: "sp", fromPos: 20, toPos: 53, side: "below" },
      ],
    };
    const r = reverseModuleFeatures(moduleFeatures(doc));
    expect(r.industries[0].fromFrac).toBeCloseTo(0.47); // 1 - 0.53
    expect(r.industries[0].toFrac).toBeCloseTo(0.8); // 1 - 0.2
    expect(r.industries[0].lane).toBe(1);
    expect(r.industries[0].side).toBe("below");
  });

  it("mirrors the single↔double transition to the other end", () => {
    // west double, transition turnout at 0.6 → after reverse, double end is east.
    const doc: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 30,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "double" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "main2", role: "main", lane: 1, from: "A", to: "B" },
      ],
      turnouts: [{ id: "sw1", pos: 18, kind: "left", onTrack: "main2", divergeTrack: "main" }],
    };
    const f = moduleFeatures(doc);
    expect(f.transition).toMatchObject({ atFrac: 0.6, doubleSide: "west" });
    const r = reverseModuleFeatures(f);
    expect(r.transition).toMatchObject({
      throughLane: 1,
      branchLane: 0,
      atFrac: 0.4, // 1 - 0.6
      doubleSide: "east",
    });
  });
});
