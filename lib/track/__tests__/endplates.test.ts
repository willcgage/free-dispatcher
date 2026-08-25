import { describe, it, expect } from "vitest";
import {
  endplateConnections,
  endplateMismatches,
  unjoinablePlacements,
  inConfig,
  outConfig,
  type ModuleEndplates,
} from "../endplates";

const mod = (
  id: string,
  a: string | null,
  b: string | null,
  flipped = false,
): ModuleEndplates => ({
  id,
  flipped,
  endplates: [
    { label: "EP-1", track_config: a },
    { label: "EP-2", track_config: b },
  ],
});

describe("in/outConfig", () => {
  it("out faces the next module (last endplate), in the previous (first)", () => {
    const m = mod("m", "single", "double");
    expect(inConfig(m)).toBe("single");
    expect(outConfig(m)).toBe("double");
  });

  it("flip swaps which endplate is in vs out", () => {
    const m = mod("m", "single", "double", true);
    expect(inConfig(m)).toBe("double");
    expect(outConfig(m)).toBe("single");
  });

  it("normalises case/whitespace and treats blank as null", () => {
    expect(inConfig(mod("m", "  Single ", "double"))).toBe("single");
    expect(inConfig(mod("m", "", "double"))).toBeNull();
    expect(inConfig({ id: "m", endplates: [] })).toBeNull();
    expect(inConfig({ id: "m" })).toBeNull();
  });
});

describe("endplateConnections", () => {
  it("flags a single→double join as a mismatch and matching as ok", () => {
    const conns = endplateConnections([
      mod("a", "single", "single"),
      mod("b", "double", "double"),
      mod("c", "double", "double"),
    ]);
    expect(conns.map((c) => c.status)).toEqual(["mismatch", "ok"]);
    expect(conns[0]).toMatchObject({
      fromId: "a",
      toId: "b",
      fromConfig: "single",
      toConfig: "double",
    });
  });

  it("is unknown when either side lacks a track_config", () => {
    const conns = endplateConnections([
      mod("a", "single", null),
      mod("b", "single", "single"),
    ]);
    expect(conns[0].status).toBe("unknown");
  });

  it("respects flip when picking the facing endplates", () => {
    // b flipped: its incoming end becomes EP-2 (single), matching a's out.
    const conns = endplateConnections([
      mod("a", "single", "single"),
      mod("b", "double", "single", true),
    ]);
    expect(conns[0].status).toBe("ok");
  });

  it("returns no connections for 0 or 1 modules", () => {
    expect(endplateConnections([])).toEqual([]);
    expect(endplateConnections([mod("a", "single", "single")])).toEqual([]);
  });
});

// modulerepo #245 — a junction module carries endplates C, D… placed along its
// SIDE. They are not the ends it presents to its neighbours, and the axial
// faces were being picked positionally, so the last record won.
describe("a junction module's branch endplates are not its axial ends", () => {
  /** FMN-0024's shape: A and B single (the through line), C and D double
   * (the second railroad, in and out along the side). Four records today. */
  const junction = (flipped = false): ModuleEndplates => ({
    id: "j",
    flipped,
    endplates: [
      { endplate_number: 1, label: "UP Spokane N", track_config: "single" },
      { endplate_number: 2, label: "UP Plummer W", track_config: "single" },
      { endplate_number: 3, label: "MR St Maries e", track_config: "double" },
      { endplate_number: 4, label: "MR Plummer S", track_config: "double" },
    ],
  });

  it("reads A and B, not the first and last record", () => {
    expect(inConfig(junction())).toBe("single");
    // ⛔ Positionally this was endplate D — "double" — so a junction module
    // joined to a single-track neighbour reported a mismatch that isn't there.
    expect(outConfig(junction())).toBe("single");
  });

  it("still mismatches on a real disagreement at the axial ends", () => {
    const conns = endplateConnections([
      junction(),
      { id: "n", endplates: [{ endplate_number: 1, track_config: "double" }] },
    ]);
    expect(conns[0].status).toBe("mismatch");
  });

  it("does not report a mismatch that only the branch plates would cause", () => {
    const conns = endplateConnections([
      junction(),
      { id: "n", endplates: [{ endplate_number: 1, track_config: "single" }] },
    ]);
    expect(conns[0].status).toBe("ok");
  });

  it("flip still swaps the two axial ends, and only those", () => {
    const asym: ModuleEndplates = {
      id: "t",
      flipped: true,
      endplates: [
        { endplate_number: 1, track_config: "single" },
        { endplate_number: 2, track_config: "double" },
        { endplate_number: 3, track_config: "single" },
      ],
    };
    expect(inConfig(asym)).toBe("double");
    expect(outConfig(asym)).toBe("single");
  });

  it("falls back to the first two when the payload carries no numbers", () => {
    // Older sync payloads, and every fixture written before #245.
    const legacy: ModuleEndplates = {
      id: "l",
      endplates: [
        { track_config: "single" },
        { track_config: "double" },
      ],
    };
    expect(inConfig(legacy)).toBe("single");
    expect(outConfig(legacy)).toBe("double");
  });
});

describe("endplateMismatches", () => {
  it("returns only the mismatched joins", () => {
    const mismatches = endplateMismatches([
      mod("a", "single", "single"),
      mod("b", "double", "double"),
      mod("c", "double", "double"),
    ]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].fromId).toBe("a");
  });
});

/**
 * ⭐⭐ A MODULE WITH ONE AXIAL END CAN ONLY BE TERMINAL (#165).
 *
 * A balloon turnback presents endplate A and nothing else — and so does a
 * pocket, and so does an end of the line (#184: three different things, one
 * face). Placed mid-spine, the modules either side are being joined to a face
 * that does not exist.
 */
describe("single-ended modules can only sit at an end of the spine (#165)", () => {
  const two = (id: string, cfg = "single"): ModuleEndplates => ({
    id,
    endplates: [
      { endplate_number: 1, track_config: cfg },
      { endplate_number: 2, track_config: cfg },
    ],
  });
  /** One axial end: a turnback, a pocket, or an end of the line. */
  const one = (id: string, cfg = "single"): ModuleEndplates => ({
    id,
    endplates: [{ endplate_number: 1, track_config: cfg }],
  });

  it("⛔ used to report a happy join on BOTH sides — now it says the arrangement can't be built", () => {
    const conns = endplateConnections([two("west"), one("loop"), two("east")]);
    // Both joins touch the single-ended module, and neither can exist.
    expect(conns.map((c) => c.status)).toEqual(["unjoinable", "unjoinable"]);
    expect(unjoinablePlacements([two("west"), one("loop"), two("east")])).toHaveLength(2);
  });

  it("at either END of the spine it is perfectly fine", () => {
    expect(endplateConnections([one("loop"), two("a"), two("b")]).map((c) => c.status))
      .toEqual(["ok", "ok"]);
    expect(endplateConnections([two("a"), two("b"), one("loop")]).map((c) => c.status))
      .toEqual(["ok", "ok"]);
  });

  it("⭐ an INTERCHANGE loop has A and B, so it may sit anywhere — the discriminator", () => {
    // This is what makes the rule a derivation rather than "loops are special":
    // it keys off how many faces the module presents, not what it is called.
    const conns = endplateConnections([two("west"), two("interchangeLoop"), two("east")]);
    expect(conns.map((c) => c.status)).toEqual(["ok", "ok"]);
  });

  it("keeps a real config mismatch distinct from an impossible placement", () => {
    const conns = endplateConnections([two("a", "single"), two("b", "double")]);
    expect(conns[0].status).toBe("mismatch");
    expect(unjoinablePlacements([two("a", "single"), two("b", "double")])).toHaveLength(0);
  });

  it("two single-ended modules alone are a legal two-module layout", () => {
    // Each presents its one face to the other; nothing is left unmatched.
    expect(endplateConnections([one("pocket"), one("loop")]).map((c) => c.status)).toEqual(["ok"]);
  });
});
