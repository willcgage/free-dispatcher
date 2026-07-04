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

export type ConnectionStatus = "ok" | "mismatch" | "unknown";

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

/** Endplates in facing order (flip reverses which end is in vs out). */
function ordered(m: ModuleEndplates): EndplateInfo[] {
  const eps = m.endplates ?? [];
  return m.flipped ? [...eps].reverse() : eps;
}

/** The track_config of the endplate that faces the NEXT module. */
export function outConfig(m: ModuleEndplates): string | null {
  const eps = ordered(m);
  return eps.length > 0 ? norm(eps[eps.length - 1].track_config) : null;
}

/** The track_config of the endplate that faces the PREVIOUS module. */
export function inConfig(m: ModuleEndplates): string | null {
  const eps = ordered(m);
  return eps.length > 0 ? norm(eps[0].track_config) : null;
}

/**
 * Compatibility of every adjacent join in the sequence. `unknown` when either
 * side's track_config is missing (nothing to compare), never a false alarm.
 */
export function endplateConnections(modules: ModuleEndplates[]): Connection[] {
  const out: Connection[] = [];
  for (let i = 0; i < modules.length - 1; i++) {
    const a = modules[i];
    const b = modules[i + 1];
    const fromConfig = outConfig(a);
    const toConfig = inConfig(b);
    const status: ConnectionStatus =
      fromConfig == null || toConfig == null
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
