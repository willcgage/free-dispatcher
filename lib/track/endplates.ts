/**
 * Endplate connection checks (#115) — when a layout's modules are chained in
 * sequence, each module's outgoing endplate meets the next module's incoming
 * endplate. A single-track end meeting a double-track end (or any track_config
 * mismatch) is a real assembly problem, so we surface it in the builder.
 *
 * Pure so it can be unit-tested; the schematic and list just render the result.
 * This is also the seam the owner-authored module schematic (#122) plugs into:
 * richer per-endplate track configs authored upstream validate here unchanged.
 */

export interface EndplateInfo {
  /** Which face this is: 1 = A, 2 = B. 3+ are BRANCH endplates (modulerepo
   * #170) — a junction module's extra connections, which are not part of the
   * linear chain and must never be mistaken for its axial ends. Absent on
   * payloads older than modulerepo #245; see `axialEnds`. */
  endplate_number?: number | null;
  label?: string | null;
  track_config?: string | null;
}

export interface ModuleEndplates {
  id: string;
  moduleName?: string | null;
  moduleId?: string | null;
  endplates?: EndplateInfo[] | null;
  /** Mirrors the placement, swapping which endplate faces each neighbour. */
  flipped?: boolean | null;
}

/**
 * `mismatch` — both sides offer a face and the faces disagree (single ↔ double).
 * `unjoinable` — one side has **no face to offer here** (#165): a module with a
 * single axial end can be joined on one side only, so it cannot sit mid-spine.
 */
export type ConnectionStatus = "ok" | "mismatch" | "unknown" | "unjoinable";

export interface Connection {
  /** Index of the earlier module in the sequence (the join sits before to). */
  fromIndex: number;
  toIndex: number;
  fromId: string;
  toId: string;
  fromConfig: string | null;
  toConfig: string | null;
  status: ConnectionStatus;
}

function norm(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 0 ? t : null;
}

/**
 * The module's two AXIAL ends — A then B — in facing order.
 *
 * ⛔ THIS USED TO BE `eps[0]` AND `eps[eps.length - 1]`, which is only ever
 * right for a module with exactly two endplates (modulerepo #245). A junction
 * module has more: endplates C, D… are BRANCH connections placed along its
 * side, not the ends it presents to the modules before and after it in the
 * chain. Positionally, the last element of a four-plate module is D — so the
 * builder was comparing a branch connection against the next module's front
 * face and calling the result a mismatch.
 *
 * That is not hypothetical: FMN-0012, FMN-0017 and FMN-0024 each carry four
 * endplate records today.
 *
 * `endplate_number` identifies the face (1 = A, 2 = B) and has always been in
 * the payload — it simply wasn't read. When it is absent (an older payload, or
 * a test fixture that omits it) we fall back to the first two entries, which is
 * exactly the old behaviour for the two-plate case that fallback can arise in.
 */
function axialEnds(m: ModuleEndplates): EndplateInfo[] {
  const eps = m.endplates ?? [];
  const numbered = eps.some((e) => e.endplate_number != null);
  const ends = numbered
    ? ([1, 2]
        .map((n) => eps.find((e) => e.endplate_number === n))
        .filter((e): e is EndplateInfo => e != null))
    : eps.slice(0, 2);
  return m.flipped ? [...ends].reverse() : ends;
}

/**
 * How many AXIAL ends this module presents — normally two, but **one** for a
 * balloon turnback, a pocket or an end of the line (#184, #165). Branch
 * endplates C, D… are junction connections along its side and never count here;
 * {@link axialEnds} already excludes them.
 */
export function axialEndCount(m: ModuleEndplates): number {
  return axialEnds(m).length;
}

/** The track_config of the endplate that faces the NEXT module. */
export function outConfig(m: ModuleEndplates): string | null {
  const ends = axialEnds(m);
  return ends.length > 0 ? norm(ends[ends.length - 1].track_config) : null;
}

/** The track_config of the endplate that faces the PREVIOUS module. */
export function inConfig(m: ModuleEndplates): string | null {
  const ends = axialEnds(m);
  return ends.length > 0 ? norm(ends[0].track_config) : null;
}

/**
 * Compatibility of every adjacent join in the sequence. `unknown` when either
 * side's track_config is missing (nothing to compare), never a false alarm.
 */
export function endplateConnections(modules: ModuleEndplates[]): Connection[] {
  const out: Connection[] = [];
  /**
   * ⭐⭐ A MODULE WITH ONE AXIAL END CAN ONLY BE TERMINAL (#165).
   *
   * A balloon turnback presents endplate A and nothing else; so does a pocket,
   * and so does an end of the line (#184 — the three are genuinely different
   * things that present the same single face). Such a module can be joined on
   * ONE side. Put it mid-spine and the modules either side of it are being
   * joined to a face that does not exist.
   *
   * ⛔ IT USED TO REPORT A HAPPY JOIN ON BOTH SIDES. `axialEnds` returns `[A]`
   * for these, so `outConfig` reads `ends[ends.length - 1]` and `inConfig` reads
   * `ends[0]` — **the same plate**. Two neighbours therefore both matched
   * against A's config and came back "ok". The arrangement was impossible and
   * nothing said so.
   *
   * ⭐ Stated on the END COUNT, not on `loop`. The rule is not "loops are
   * special" — it is "one face can only face one way", which is equally true of
   * a pocket. An INTERCHANGE loop has A and B and is unaffected, which is the
   * discriminator that makes this a derivation rather than a special case.
   */
  const singleEnded = modules.map((m) => axialEndCount(m) === 1);
  for (let i = 0; i < modules.length - 1; i++) {
    const a = modules[i];
    const b = modules[i + 1];
    const fromConfig = outConfig(a);
    const toConfig = inConfig(b);
    // `a` faces forward here, so it must have nothing behind it; `b` faces
    // back, so it must have nothing ahead of it.
    const aHasNoFaceHere = singleEnded[i] && i > 0;
    const bHasNoFaceHere = singleEnded[i + 1] && i + 1 < modules.length - 1;
    const status: ConnectionStatus =
      aHasNoFaceHere || bHasNoFaceHere
        ? "unjoinable"
        : fromConfig == null || toConfig == null
          ? "unknown"
          : fromConfig === toConfig
            ? "ok"
            : "mismatch";
    out.push({
      fromIndex: i,
      toIndex: i + 1,
      fromId: a.id,
      toId: b.id,
      fromConfig,
      toConfig,
      status,
    });
  }
  return out;
}

/** Just the mismatched joins, for a warning summary. */
export function endplateMismatches(modules: ModuleEndplates[]): Connection[] {
  return endplateConnections(modules).filter((c) => c.status === "mismatch");
}

/**
 * Joins that cannot exist at all, because one side has no face there (#165) —
 * a turnback, pocket or end-of-line module placed anywhere but at an end.
 * Kept apart from {@link endplateMismatches}: a mismatch is two real faces that
 * disagree and a crew can still couple them; this is an arrangement that cannot
 * be built.
 */
export function unjoinablePlacements(modules: ModuleEndplates[]): Connection[] {
  return endplateConnections(modules).filter((c) => c.status === "unjoinable");
}
