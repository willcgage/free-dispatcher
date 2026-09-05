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
import {
  asModuleSchematic,
  moduleFeatures,
  drawsFromOneEnd,
  type ModuleSchematicDoc,
} from "../moduleSchematic";
import { deriveEndplatePoses, moduleFootprint } from "@willcgage/module-schematic";

describe("package contract — the numbers that reach the dispatcher", () => {
  /**
   * ⭐⭐ THE INVARIANT THAT WOULD HAVE CAUGHT BOTH SIDES OF IT.
   *
   * A drawn endplate face must be SQUARE to the heading the app derives for that
   * very plate. `deriveEndplatePoses` is analytic; the face is built from the
   * sampled spine. When those two disagree, one of them is wrong — and across
   * three package versions they disagreed twice, in opposite directions:
   *
   *   0.147.0  a curved module's face was 3.75° off  (modulerepo#346)
   *   0.152.0  a straight-then-curved module's face A was 1.875° off the OTHER
   *            way — a regression introduced by the fix for the first
   *   0.153.0  square, both
   *
   * FD draws these faces. This asserts the relationship rather than the numbers,
   * so it holds for any module and cannot rot the way a coordinate can.
   */
  const squareToItsPose = (input: Parameters<typeof moduleFootprint>[0]) => {
    const fp = moduleFootprint(input);
    const poses = deriveEndplatePoses(input);
    return fp.endplateFaces.map((f, i) => {
      const faceDeg = (Math.atan2(f.p2.y - f.p1.y, f.p2.x - f.p1.x) * 180) / Math.PI;
      const between = ((((faceDeg - poses[i].heading) % 180) + 180) % 180);
      return Math.abs(between - 90);
    });
  };

  it("every endplate face is square to its own plate's heading — a whole-module curve", () => {
    // FMN-0081: 30″ of 90° curve. On 0.147.0 face A was 3.75° out.
    const off = squareToItsPose({
      lengthInches: 30,
      geometryType: "curve",
      geometryDegrees: 90,
      endplateConfigs: ["single", "single"],
    });
    off.forEach((d) => expect(d).toBeLessThan(0.001));
  });

  it("…and when the module is BOARDS: straight, then a bend", () => {
    // FMN-0082. On 0.152.0 face A came out 1.875° out — the regression that a
    // corpus diff caught and this test now pins.
    const off = squareToItsPose({
      lengthInches: 48,
      geometryType: "straight",
      endplateConfigs: ["single", "single"],
      sections: [
        { id: "sec1", geometryType: "straight", lengthInches: 24 },
        { id: "sec2", geometryType: "curve", lengthInches: 24, geometryDegrees: 90 },
      ],
    });
    off.forEach((d) => expect(d).toBeLessThan(0.001));
  });

  it("a curved module's far face is where the bend leaves it (FMN-0081)", () => {
    // The value, not just the relationship: on 0.147.0 this face ran
    // (7.1243, 19.8834) → (31.0729, 18.3138) — visibly sloped on a face that
    // should be flat, because the module turns exactly 90°.
    const fp = moduleFootprint({
      lengthInches: 30,
      geometryType: "curve",
      geometryDegrees: 90,
      endplateConfigs: ["single", "single"],
    });
    const b = fp.endplateFaces[1];
    expect(b.p1.y).toBeCloseTo(b.p2.y, 6); // flat
    expect(b.p1.y).toBeCloseTo(19.0986, 3);
  });

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
   * A spot with no side of its own must come back on the INDUSTRY'S side
   * (modulerepo#421, pkg 0.159.0).
   *
   * ⛔ Until 0.159.0 the package answered `"above"` here while MR — which
   * AUTHORS the document — drew the same spot on `sp.side ?? ind.side`. From
   * one document, an industry marked BELOW its rail was drawn below in the
   * builder and its own spot ABOVE in this app. FD has no copy of the rule to
   * get wrong; it renders what `moduleFeatures` hands it, which is exactly why
   * the disagreement was invisible from this end.
   */
  it("a spot with no side inherits its industry's, not \"above\" (#421)", () => {
    const doc = asModuleSchematic({
      // ⚠️ `version` IS LOAD-BEARING: `asModuleSchematic` returns null without a
      // numeric one, and a null doc fails this test for a reason that has
      // nothing to do with sides. Two of my drafts died here.
      version: 1,
      module: "FMN-0083",
      lengthInches: 48,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      // ⚠️ The SAME doc shape the tests above validate. My first version left
      // the turnouts out and `asModuleSchematic` returned NULL, so the test was
      // asserting against a null document — it failed for the fixture, not the
      // code (see freemon memory: a convenient fixture is worse than none).
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
          id: "ind1", name: "Ace Feed", track: "spur",
          fromPos: 12, toPos: 26, side: "below",
          spots: [
            { track: "sid", fromPos: 20, toPos: 32, side: "above" }, // states its own
            { track: "sid", fromPos: 34, toPos: 38 },               // does not
          ],
        },
      ],
    }) as ModuleSchematicDoc;
    const sides = moduleFeatures(doc).industries.map((i) => i.side);
    //            industry   spot that states   spot that does not
    expect(sides).toEqual(["below", "above", "below"]);
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

describe("house track — the third role FD must draw (#417)", () => {
  it("draws from ONE end, like a spur and unlike a siding", () => {
    // ⭐ FD's OperationsSchematic used to carry its own `role === "spur"`, as did
    // MR's two renderers. Three copies of one fact; a new role would have made
    // them disagree. This asserts FD reads the package's answer.
    expect(drawsFromOneEnd("house")).toBe(true);
    expect(drawsFromOneEnd("spur")).toBe(true);
    expect(drawsFromOneEnd("siding")).toBe(false);
  });

  it("carries the role through `moduleFeatures` untouched, so the panel can label it", () => {
    const doc = asModuleSchematic({
      version: 1,
      lengthInches: 48,
      endplates: [
        { id: "A", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
        { id: "B", tracks: [{ trackId: "main", lane: 0, config: "single" }] },
      ],
      tracks: [
        { id: "main", role: "main", lane: 0, from: "A", to: "B" },
        { id: "hse", role: "house", lane: 1, fromPos: 12, toPos: 30 },
      ],
      turnouts: [
        { id: "sw1", pos: 12, onTrack: "main", divergeTrack: "hse", kind: "right" },
      ],
    }) as ModuleSchematicDoc;
    const t = moduleFeatures(doc).extraTracks.find((x) => x.id === "hse");
    // ⚠️ An unknown role must not be silently rewritten to "siding" on the way
    // through — the panel needs the owner's word to label it.
    expect(t?.role).toBe("house");
    // And its throat/stub are populated, which is what `drawsFromOneEnd` gates.
    expect(Number.isFinite(t!.throatFrac)).toBe(true);
    expect(Number.isFinite(t!.stubFrac)).toBe(true);
  });
})
