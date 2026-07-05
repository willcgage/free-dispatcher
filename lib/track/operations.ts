/**
 * Operations schematic (#115 / #122) — the *straightened* dispatcher view.
 *
 * Real CTC / dispatching panels throw geography away: the mainline is drawn as a
 * horizontal spine (West → East), and the diagram only branches where topology
 * forces it (junctions). Curve/corner geometry is a footprint concern, not an
 * operations one. What matters here is the sequence of modules, how many main
 * tracks each carries (single vs double), and where that count changes — the
 * control points where meets happen.
 *
 * This pure builder lays the module sequence out along the spine and resolves
 * each module's left/right main-track count from its endplate track_config
 * (single → 1, double → 2), carrying a known count across modules whose config
 * is unknown so the line stays continuous. The SVG component just draws it.
 */
import { inConfig, outConfig, type ModuleEndplates } from "./endplates";
import { asModuleSchematic } from "./moduleSchematic";

export interface OpsModuleInput extends ModuleEndplates {
  stagingEnd?: "A" | "B" | null;
  mainlineLengthInches?: number | null;
  lengthTotalInches?: number | null;
  /** Owner-authored track-graph (jsonb); overlaid when present (#122). */
  schematic?: unknown;
}

export interface OpsCell {
  input: OpsModuleInput;
  /** Left edge along the spine, in inches from the West end. */
  x: number;
  /** Width along the spine, in inches (∝ mainline length). */
  width: number;
  /** Main-track count entering (West end) and leaving (East end). */
  leftTracks: number;
  rightTracks: number;
}

export interface OperationsSchematic {
  cells: OpsCell[];
  totalInches: number;
  /** Widest track count anywhere — how many lanes the diagram needs. */
  maxTracks: number;
}

/** Minimum drawn width so a short module is still legible. */
export const MIN_CELL_INCHES = 12;
/** Fallback length when a module reports none. */
export const DEFAULT_CELL_INCHES = 24;

/** Main-track count from an endplate track_config; null when unknown. */
export function trackCount(config: string | null): number | null {
  if (config === "single") return 1;
  if (config === "double") return 2;
  return null;
}

export function buildOperationsSchematic(
  modules: OpsModuleInput[],
): OperationsSchematic {
  // First pass: raw left/right counts (may be null) and cell widths.
  let x = 0;
  const cells: OpsCell[] = modules.map((m) => {
    // When a module has an authored schematic, its features are positioned in
    // the schematic's own coordinate space (its lengthInches), so the cell must
    // be that wide or the overlaid sidings/turnouts/signals won't line up.
    const doc = asModuleSchematic(m.schematic);
    const schematicLen = doc?.lengthInches;
    const len =
      (schematicLen && schematicLen > 0
        ? schematicLen
        : m.mainlineLengthInches && m.mainlineLengthInches > 0
          ? m.mainlineLengthInches
          : m.lengthTotalInches && m.lengthTotalInches > 0
            ? m.lengthTotalInches
            : DEFAULT_CELL_INCHES) || DEFAULT_CELL_INCHES;
    const width = Math.max(len, MIN_CELL_INCHES);
    // The authored schematic also declares single/double; trust it when the
    // physical endplate track_config is missing (modulerepo#14).
    const schemTracks = doc
      ? doc.endplates.some((e) => e.tracks?.some((t) => t.config === "double"))
        ? 2
        : 1
      : null;
    const cell: OpsCell = {
      input: m,
      x,
      width,
      leftTracks: trackCount(inConfig(m)) ?? schemTracks ?? 0,
      rightTracks: trackCount(outConfig(m)) ?? schemTracks ?? 0,
    };
    x += width;
    return cell;
  });

  // Second pass: carry a known count across unknown (0) ends so the spine is
  // continuous; default the very first unknown to a single main.
  let carried = 1;
  for (const cell of cells) {
    if (cell.leftTracks === 0) cell.leftTracks = carried;
    if (cell.rightTracks === 0) cell.rightTracks = cell.leftTracks;
    carried = cell.rightTracks;
  }

  const maxTracks = cells.reduce(
    (m, c) => Math.max(m, c.leftTracks, c.rightTracks),
    1,
  );

  return { cells, totalInches: x, maxTracks };
}

/**
 * Control points: boundaries where the main-track count changes (single↔double)
 * — inside a module (its two ends differ) or at a join between modules. These
 * are the interlockings/crossovers a dispatcher cares about.
 */
export interface ControlPoint {
  /** Position along the spine, in inches from the West end. */
  x: number;
  fromTracks: number;
  toTracks: number;
  /** Human label for the nearest module. */
  label: string | null;
}

export function controlPoints(schem: OperationsSchematic): ControlPoint[] {
  const out: ControlPoint[] = [];
  const name = (c: OpsCell) => c.input.moduleName ?? c.input.moduleId ?? null;
  schem.cells.forEach((c, i) => {
    // Transition inside the module (its ends differ).
    if (c.leftTracks !== c.rightTracks) {
      out.push({
        x: c.x + c.width / 2,
        fromTracks: c.leftTracks,
        toTracks: c.rightTracks,
        label: name(c),
      });
    }
    // Transition at the join to the next module.
    const next = schem.cells[i + 1];
    if (next && c.rightTracks !== next.leftTracks) {
      out.push({
        x: next.x,
        fromTracks: c.rightTracks,
        toTracks: next.leftTracks,
        label: name(next),
      });
    }
  });
  return out;
}
