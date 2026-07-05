import { describe, it, expect } from "vitest";
import {
  buildOperationsSchematic,
  controlPoints,
  trackCount,
  MIN_CELL_INCHES,
  type OpsModuleInput,
} from "../operations";

const mod = (
  id: string,
  a: string | null,
  b: string | null,
  opts: Partial<OpsModuleInput> = {},
): OpsModuleInput => ({
  id,
  moduleName: id,
  flipped: false,
  endplates: [
    { label: "EP-1", track_config: a },
    { label: "EP-2", track_config: b },
  ],
  mainlineLengthInches: 48,
  ...opts,
});

describe("trackCount", () => {
  it("maps single→1, double→2, unknown→null", () => {
    expect(trackCount("single")).toBe(1);
    expect(trackCount("double")).toBe(2);
    expect(trackCount("triple")).toBeNull();
    expect(trackCount(null)).toBeNull();
  });
});

describe("buildOperationsSchematic", () => {
  it("lays modules West→East with widths ∝ length and cumulative x", () => {
    const s = buildOperationsSchematic([
      mod("a", "single", "single", { mainlineLengthInches: 48 }),
      mod("b", "double", "double", { mainlineLengthInches: 96 }),
    ]);
    expect(s.cells[0]).toMatchObject({ x: 0, width: 48 });
    expect(s.cells[1]).toMatchObject({ x: 48, width: 96 });
    expect(s.totalInches).toBe(144);
  });

  it("resolves single vs double from endplate track_config", () => {
    const s = buildOperationsSchematic([
      mod("a", "single", "single"),
      mod("b", "double", "double"),
    ]);
    expect(s.cells[0]).toMatchObject({ leftTracks: 1, rightTracks: 1 });
    expect(s.cells[1]).toMatchObject({ leftTracks: 2, rightTracks: 2 });
    expect(s.maxTracks).toBe(2);
  });

  it("models an in-module transition (single on one end, double on the other)", () => {
    const s = buildOperationsSchematic([mod("a", "single", "double")]);
    expect(s.cells[0]).toMatchObject({ leftTracks: 1, rightTracks: 2 });
  });

  it("carries a known count across modules with unknown config", () => {
    const s = buildOperationsSchematic([
      mod("a", "double", "double"),
      mod("b", null, null), // unknown → inherits double from the left
      mod("c", "double", "double"),
    ]);
    expect(s.cells[1]).toMatchObject({ leftTracks: 2, rightTracks: 2 });
  });

  it("defaults the leading unknown module to a single main", () => {
    const s = buildOperationsSchematic([mod("a", null, null)]);
    expect(s.cells[0]).toMatchObject({ leftTracks: 1, rightTracks: 1 });
  });

  it("sizes the cell to the schematic's own length so features line up", () => {
    // Module record says 396", but the authored schematic uses 432" — the cell
    // must be 432 or the overlaid siding/turnout/signal positions won't match.
    const s = buildOperationsSchematic([
      mod("a", "single", "single", {
        mainlineLengthInches: 396,
        lengthTotalInches: 396,
        schematic: {
          version: 1,
          lengthInches: 432,
          endplates: [],
          tracks: [{ id: "main", role: "main", lane: 0 }],
        },
      }),
    ]);
    expect(s.cells[0].width).toBe(432);
  });

  it("enforces a minimum drawn width", () => {
    const s = buildOperationsSchematic([
      mod("a", "single", "single", { mainlineLengthInches: 2, lengthTotalInches: 2 }),
    ]);
    expect(s.cells[0].width).toBe(MIN_CELL_INCHES);
  });

  it("respects flip when reading the facing endplates", () => {
    // flipped: EP order reverses, so left=double(EP-2), right=single(EP-1).
    const s = buildOperationsSchematic([
      mod("a", "single", "double", { flipped: true }),
    ]);
    expect(s.cells[0]).toMatchObject({ leftTracks: 2, rightTracks: 1 });
  });
});

describe("controlPoints", () => {
  it("flags an in-module single↔double transition at the module centre", () => {
    const s = buildOperationsSchematic([
      mod("a", "single", "double", { mainlineLengthInches: 48 }),
    ]);
    const cps = controlPoints(s);
    expect(cps).toHaveLength(1);
    expect(cps[0]).toMatchObject({ x: 24, fromTracks: 1, toTracks: 2 });
  });

  it("flags a transition at a module join", () => {
    const s = buildOperationsSchematic([
      mod("a", "double", "double", { mainlineLengthInches: 48 }),
      mod("b", "single", "single", { mainlineLengthInches: 48 }),
    ]);
    const cps = controlPoints(s);
    // double→single occurs at the join (x = 48).
    expect(cps.some((c) => c.x === 48 && c.fromTracks === 2 && c.toTracks === 1)).toBe(
      true,
    );
  });

  it("reports no control points for a uniform single-track spine", () => {
    const s = buildOperationsSchematic([
      mod("a", "single", "single"),
      mod("b", "single", "single"),
    ]);
    expect(controlPoints(s)).toEqual([]);
  });
});
