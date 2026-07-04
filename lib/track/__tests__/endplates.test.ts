import { describe, it, expect } from "vitest";
import {
  endplateConnections,
  endplateMismatches,
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
