/**
 * ⛔⛔ WHAT THE PACKAGE HANDS US — pinned, because nothing here noticed a
 * 76-MINOR JUMP.
 *
 * Bumping `@willcgage/module-schematic` from 0.71.0 to 0.147.0 changed the
 * result for EVERY ONE of the 37 real modules in the catalogue, and this suite
 * reported the same 176 passes before and after. It could not see the change
 * because nothing here fed a real document through the package and asserted the
 * numbers that reach the dispatcher.
 *
 * These are those numbers. Each one was measurably WRONG on 0.71.0 and each is
 * a documented fix, so a regression shows up as a value, not as a crash.
 */
import { describe, it, expect } from "vitest";
import { asModuleSchematic, moduleFeatures, type ModuleSchematicDoc } from "../moduleSchematic";
import { deriveEndplatePoses } from "@willcgage/module-schematic";

describe("package contract — the numbers that reach the dispatcher", () => {
  /**
   * modulerepo#310. The app used to COMPUTE a car count from rail length and
   * overwrite the owner's. Will's call: capacity belongs to industries only, and
   * the owner enters the cars, per track.
   *
   * FMN-0083 authors cars: 3 on its spur and cars: 7 on its extra siding spot.
   * On 0.71.0 the package answered 4 and 3 — its own arithmetic, not the
   * owner's figures. FD already renders "no count" correctly (#218/#219); this
   * is the DATA half, which only arrived with the bump.
   */
  it("reports the owner's authored car counts, not arithmetic (#310)", () => {
    const doc = asModuleSchematic({
      version: 1,
      module: "FMN-0083",
      lengthInches: 48,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "sid", role: "siding", lane: 1, fromPos: 8, toPos: 40 },
        { id: "spur", role: "spur", lane: -1, fromPos: 10, toPos: 30 },
      ],
      turnouts: [
        { id: "sw1", pos: 8, onTrack: "main", divergeTrack: "sid", kind: "left" },
        { id: "sw2", pos: 10, onTrack: "main", divergeTrack: "spur", kind: "right" },
      ],
      industries: [
        {
          id: "ind1", name: "Ace Feed", type: "grain_elevator", track: "spur",
          fromPos: 12, toPos: 26, cars: 3, side: "below", labelMode: "cars",
          spots: [{ track: "sid", fromPos: 20, toPos: 32, cars: 7, side: "above" }],
        },
      ],
    }) as ModuleSchematicDoc;
    const cars = moduleFeatures(doc).industries.map((i) => i.cars);
    // 3 and 7 are what the owner typed. 0.71.0 said 4 and 3.
    expect(cars).toEqual([3, 7]);
  });

  /**
   * An industry with NO authored count must report nothing — not a number the
   * package made up, and not 0. This is the pairing for #218/#219: those made FD
   * DISPLAY an absent count correctly, and this makes sure the count really is
   * absent. On 0.71.0 thirteen industries across the catalogue came back with an
   * invented figure (FMN-0011's five all said 18).
   */
  it("an industry with no authored count reports none, not an invented one (#310)", () => {
    const doc = asModuleSchematic({
      version: 1,
      module: "T",
      lengthInches: 48,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "spur", role: "spur", lane: -1, fromPos: 4, toPos: 44 },
      ],
      turnouts: [{ id: "sw", pos: 4, onTrack: "main", divergeTrack: "spur", kind: "right" }],
      industries: [
        { id: "i", name: "Long dock", type: "warehouse", track: "spur",
          fromPos: 6, toPos: 42, side: "below", spots: [] },
      ],
    }) as ModuleSchematicDoc;
    const [ind] = moduleFeatures(doc).industries;
    // 36″ of rail would divide into ~10 cars. The package must not say so.
    expect(ind.cars ?? null).toBeNull();
  });

  /**
   * modulerepo#329. A double endplate's two tracks are FREEMO_TRACK_SPACING
   * (1.125″) apart — 0.71.0 used Free-mo HO's 1″ half-spacing and put them 2″
   * apart. 30 offsets across the catalogue moved.
   */
  it("a double endplate's two tracks are 1.125″ apart (#329)", () => {
    const [, b] = deriveEndplatePoses({
      lengthInches: 48,
      endplateConfigs: ["single", "double"],
    });
    expect(b.trackOffsets).toEqual([-0.5625, 0.5625]);
  });

  /**
   * modulerepo#170. A BRANCH endplate faces out of the side of the board, so it
   * belongs on the fascia — not buried on the centre line, which is a place no
   * train can leave from. `composeFootprint` places a neighbour by this pose, so
   * a layout joined at a branch endplate lands 12″ out from where 0.71.0 put it.
   */
  it("a branch endplate sits on the board edge, not the centre line (#170)", () => {
    const poses = deriveEndplatePoses({
      lengthInches: 96,
      endplateConfigs: ["single", "single"],
      branches: [{ id: "C", atPos: 48, side: "up", config: "single" }],
    });
    const c = poses.find((p) => p.id === "C")!;
    expect(c.x).toBe(48);
    expect(c.y).toBeGreaterThan(0); // 0.71.0 gave 0
    expect(c.heading).toBe(90);
  });
});
