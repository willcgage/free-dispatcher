/**
 * Reverse a module's resolved features west↔east (#reverse) — used by the
 * straightened Operations schematic to draw a turned-around placement (flipped)
 * with its content on the correct end. Every along-module position (a fraction
 * from the A end) mirrors to `1 - frac`; signal facing flips; the single↔double
 * transition and Main 2's partial extent mirror with it. Lanes (north/south) are
 * left as-is — the straightened panel is topological, and the gap this closes is
 * about which END a feature sits on, not which side.
 *
 * Pure so it unit-tests without a database.
 */
import type { ModuleFeatures } from "./moduleSchematic";

const flip = (frac: number) => 1 - frac;

export function reverseModuleFeatures(f: ModuleFeatures): ModuleFeatures {
  return {
    ...f,
    extraTracks: f.extraTracks.map((t) => ({
      ...t,
      // fromFrac/toFrac stay sorted (west→east) after mirroring.
      fromFrac: flip(t.toFrac),
      toFrac: flip(t.fromFrac),
      throatFrac: flip(t.throatFrac),
      stubFrac: flip(t.stubFrac),
    })),
    turnouts: f.turnouts.map((t) => ({ ...t, posFrac: flip(t.posFrac) })),
    signals: f.signals.map((s) => ({
      ...s,
      posFrac: flip(s.posFrac),
      facing: s.facing === "AtoB" ? "BtoA" : "AtoB",
    })),
    crossings: f.crossings.map((x) => ({ ...x, posFrac: flip(x.posFrac) })),
    crossovers: f.crossovers.map((x) => ({
      ...x,
      fromPosFrac: flip(x.fromPosFrac),
      toPosFrac: flip(x.toPosFrac),
    })),
    branchConnectors: f.branchConnectors.map((b) => ({
      ...b,
      // BOTH ends of the run mirror. Flipping only where it leaves the main
      // would leave the route running back the way it came (#181). Unlike a
      // siding these do NOT re-sort: the run has a direction — it starts at the
      // main and ends at the endplate — so the ends keep their roles.
      posFrac: flip(b.posFrac),
      endFrac: flip(b.endFrac),
    })),
    // ⛔ AN UNREACHED PLATE'S POSITION MIRRORS TOO (#367). It arrived in 0.154.0
    // and `...f` above would have carried it through UNFLIPPED — a turned-around
    // module would draw the plate at the wrong end, and silently, because
    // nothing else about it looks wrong. Every along-module fraction mirrors;
    // there is no exception for a new one.
    // No `endFrac` here on purpose: with no route there is no edge to mirror.
    unreachedEndplates: f.unreachedEndplates.map((u) => ({
      ...u,
      posFrac: flip(u.posFrac),
    })),
    industries: f.industries.map((ind) => ({
      ...ind,
      // Span stays sorted west→east after mirroring; lane/side left as-is.
      fromFrac: flip(ind.toFrac),
      toFrac: flip(ind.fromFrac),
    })),
    main2Extent: f.main2Extent
      ? { fromFrac: flip(f.main2Extent.toFrac), toFrac: flip(f.main2Extent.fromFrac) }
      : null,
    transition: f.transition
      ? {
          ...f.transition,
          atFrac: flip(f.transition.atFrac),
          doubleSide: f.transition.doubleSide === "west" ? "east" : "west",
        }
      : null,
  };
}
