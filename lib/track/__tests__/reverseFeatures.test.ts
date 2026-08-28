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

  it("mirrors BOTH ends of a route to a third endplate (#181, #183)", () => {
    // The route runs to the module's EDGE and ends at a plate, because an
    // endplate is an endplate whatever letter it carries. Turn the module round
    // in the layout and it has to leave by the OTHER edge — mirroring only where
    // it departs the main would leave it running back the way it came.
    const doc: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 100,
      endplates: [
        { id: "A" },
        { id: "B" },
        {
          id: "C",
          label: "Coast Sub",
          kind: "main",
          trackId: "br",
          at: { pos: 30, side: "up" },
        },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        {
          id: "br",
          role: "branch",
          lane: 2,
          fromPos: 30,
          toPos: 30,
          path: [
            { x: 30, y: 0 },
            { x: 30, y: 15 },
          ],
        },
      ],
      turnouts: [{ id: "sw", pos: 30, onTrack: "main", divergeTrack: "br", kind: "right" }],
    };
    const f = moduleFeatures(doc);
    expect(f.branchConnectors[0].posFrac).toBeCloseTo(0.3); // leaves the main
    expect(f.branchConnectors[0].endFrac).toBe(1); // …and exits at the edge
    // Its real 15″ on the module is still reported, even though the drawn run is
    // the width of the strip.
    expect(f.branchConnectors[0].lengthInches).toBeCloseTo(15);

    const b = reverseModuleFeatures(f).branchConnectors[0];
    expect(b.posFrac).toBeCloseTo(0.7);
    expect(b.endFrac).toBe(0); // the other edge now
    expect(b.lane).toBe(f.branchConnectors[0].lane); // lanes are left alone
  });

  it("mirrors a third endplate NO route reaches (#367)", () => {
    // ⛔ THE ONE THE BUMP TO 0.154.0 NEARLY GOT WRONG. `unreachedEndplates`
    // arrived as a NEW field and `reverseModuleFeatures` spreads `...f`, so it
    // sailed through UNFLIPPED — a turned-around module would have drawn the
    // plate at the wrong end, and silently, because nothing else about it looks
    // out of place. Every along-module fraction mirrors; a new one is not an
    // exception.
    const doc: ModuleSchematicDoc = {
      version: 1,
      lengthInches: 100,
      endplates: [
        { id: "A" },
        { id: "B" },
        // Declared at 30 of 100, and NOTHING runs to it — no trackId.
        { id: "C", label: "MoPac", kind: "main", at: { pos: 30, side: "up" } },
      ],
      tracks: [{ id: "main", role: "main", lane: 0, from: "A", to: "B" }],
      turnouts: [],
    };
    const f = moduleFeatures(doc);
    // No route, so it is NOT a connector — that half is #170's call and stands.
    expect(f.branchConnectors).toEqual([]);
    expect(f.unreachedEndplates).toHaveLength(1);
    expect(f.unreachedEndplates[0].posFrac).toBeCloseTo(0.3);
    expect(f.unreachedEndplates[0].reason).toBe("no-track");

    const u = reverseModuleFeatures(f).unreachedEndplates[0];
    expect(u.posFrac).toBeCloseTo(0.7); // ← fails without the fix: stays 0.3
    expect(u.lane).toBe(f.unreachedEndplates[0].lane); // lanes are left alone
    expect(u.side).toBe(f.unreachedEndplates[0].side); // …and so is the side
    expect(u.reason).toBe("no-track");
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
