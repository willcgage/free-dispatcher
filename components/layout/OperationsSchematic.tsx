/**
 * OperationsSchematic (#115 / #122) — the straightened dispatcher panel.
 *
 * The mainline is a horizontal spine (West → East). Main 1 runs unbroken the
 * whole length; a second main appears as a parallel line that diverges/converges
 * through turnouts at the control points where single becomes double. Modules are
 * coloured by district territory. Geometry (curves/corners) is deliberately
 * ignored here — that's the footprint view's job; a dispatcher needs topology,
 * track count, and control points, not angles.
 */
"use client";

import {
  buildOperationsSchematic,
  controlPoints,
  type OpsModuleInput,
} from "@/lib/track/operations";
import { endplateConnections } from "@/lib/track/endplates";
import {
  districtColor,
  districtLegend,
  moduleDistrictMap,
} from "@/lib/track/districts";
import {
  moduleSectionMap,
  sectionSpans,
  type SectionAwareDistrict,
} from "@/lib/track/sections";
import { asModuleSchematic, moduleFeatures } from "@/lib/track/moduleSchematic";

// All coordinates are in inches (the spine's natural unit); the SVG scales.
const LANE_GAP = 12; // vertical gap between Main 1 and Main 2
const PAD_X = 12;
const SECTION_LABEL_Y = 6; // section name (top band)
const SECTION_BRACKET_Y = 9; // section bracket line
const Y1 = 32; // Main 2 (upper) — headroom above for siding/spur lanes
const Y0 = Y1 + LANE_GAP; // Main 1 (lower, continuous)
const LABEL_Y = Y0 + 10;
const HEIGHT = LABEL_Y + 6;
const STROKE = 2.4;

/** Lane index → y. Lane 0 is Main 1; higher lanes stack upward. */
const laneY = (lane: number) => Y0 - lane * LANE_GAP;

export function OperationsSchematic({
  modules,
  districts,
}: {
  modules: OpsModuleInput[];
  districts?: SectionAwareDistrict[];
}) {
  if (modules.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600">
        No modules to diagram yet.
      </div>
    );
  }

  const schem = buildOperationsSchematic(modules);
  const cps = controlPoints(schem);
  const connections = endplateConnections(modules);
  const dmap = districts ? moduleDistrictMap(districts) : new Map();
  const legend = districts ? districtLegend(districts) : [];
  const smap = districts ? moduleSectionMap(districts) : new Map();
  // Contiguous runs of modules that share a section — one bracket each.
  const spans = sectionSpans(schem.cells, (c) =>
    c.input.moduleId ? smap.get(c.input.moduleId) : undefined,
  );

  const total = schem.totalInches;
  const viewBox = `${-PAD_X} 0 ${total + 2 * PAD_X} ${HEIGHT}`;
  const feet = Math.round((total / 12) * 10) / 10;

  const colorFor = (moduleId?: string | null) =>
    (moduleId && dmap.get(moduleId)?.index != null
      ? districtColor(dmap.get(moduleId)!.index)
      : "#64748b");

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Operations schematic · straightened</span>
        <span>{feet} ft mainline</span>
      </div>
      <svg
        viewBox={viewBox}
        width="100%"
        height="140"
        preserveAspectRatio="xMidYMid meet"
        className="rounded-md border border-slate-700 bg-slate-900"
      >
        {/* Compass ends */}
        <text x={-PAD_X + 1} y={Y0 - LANE_GAP / 2} className="fill-slate-500" fontSize="7" dominantBaseline="middle">
          W
        </text>
        <text x={total + PAD_X - 1} y={Y0 - LANE_GAP / 2} textAnchor="end" className="fill-slate-500" fontSize="7" dominantBaseline="middle">
          E
        </text>

        {/* Section brackets — the units a dispatcher allocates */}
        {spans
          .filter((s) => s.sectionName)
          .map((s, i) => {
            const first = s.items[0];
            const last = s.items[s.items.length - 1];
            const startX = first.x;
            const endX = last.x + last.width;
            const track = first.input.moduleId
              ? smap.get(first.input.moduleId)?.track
              : null;
            return (
              <g key={`sec-${i}`}>
                <line x1={startX} y1={SECTION_BRACKET_Y} x2={endX} y2={SECTION_BRACKET_Y} stroke="#475569" strokeWidth={0.7} />
                <line x1={startX} y1={SECTION_BRACKET_Y - 2.5} x2={startX} y2={SECTION_BRACKET_Y} stroke="#475569" strokeWidth={0.7} />
                <line x1={endX} y1={SECTION_BRACKET_Y - 2.5} x2={endX} y2={SECTION_BRACKET_Y} stroke="#475569" strokeWidth={0.7} />
                <text x={(startX + endX) / 2} y={SECTION_LABEL_Y} textAnchor="middle" className="fill-slate-400" fontSize="6">
                  {s.sectionName}
                  {track ? ` · ${track}` : ""}
                </text>
              </g>
            );
          })}

        {/* Per-module: Main 1 (continuous) + Main 2 (where double) + turnouts */}
        {schem.cells.map((c) => {
          const stroke = colorFor(c.input.moduleId);
          const hasSecond = c.leftTracks >= 2 || c.rightTracks >= 2;
          const inSwitch = Math.min(c.width * 0.3, 30);
          const lane1Start = c.leftTracks >= 2 ? c.x : c.x + inSwitch + LANE_GAP;
          const lane1End =
            c.rightTracks >= 2 ? c.x + c.width : c.x + c.width - inSwitch - LANE_GAP;
          return (
            <g key={c.input.id}>
              {/* Main 1 — always continuous */}
              <line
                x1={c.x}
                y1={Y0}
                x2={c.x + c.width}
                y2={Y0}
                stroke={stroke}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
              {/* Main 2 + diverge/converge turnouts */}
              {hasSecond && (
                <>
                  {lane1End > lane1Start && (
                    <line
                      x1={lane1Start}
                      y1={Y1}
                      x2={lane1End}
                      y2={Y1}
                      stroke={stroke}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                    />
                  )}
                  {c.leftTracks < 2 && (
                    <line
                      x1={c.x + inSwitch}
                      y1={Y0}
                      x2={lane1Start}
                      y2={Y1}
                      stroke={stroke}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                    />
                  )}
                  {c.rightTracks < 2 && (
                    <line
                      x1={lane1End}
                      y1={Y1}
                      x2={c.x + c.width - inSwitch}
                      y2={Y0}
                      stroke={stroke}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                    />
                  )}
                </>
              )}
              {/* Module boundary tick */}
              {c.x > 0 && (
                <line
                  x1={c.x}
                  y1={Y1 - 4}
                  x2={c.x}
                  y2={Y0 + 4}
                  stroke="#334155"
                  strokeWidth={0.6}
                />
              )}
              {/* Staging yard glyph at the module's staging end */}
              {c.input.stagingEnd &&
                [0, 1, 2].map((k) => {
                  const ex =
                    c.input.stagingEnd === "A" ? c.x + 2 + k * 3 : c.x + c.width - 2 - k * 3;
                  return (
                    <line
                      key={k}
                      x1={ex}
                      y1={Y0 + 3 + k}
                      x2={ex + 6}
                      y2={Y0 + 3 + k}
                      stroke="#818cf8"
                      strokeWidth={0.8}
                    />
                  );
                })}
              {/* Hover detail + centred label */}
              <rect x={c.x} y={0} width={c.width} height={HEIGHT} fill="transparent">
                <title>
                  {`${c.input.moduleName ?? c.input.moduleId} · ${
                    c.leftTracks === c.rightTracks
                      ? `${c.leftTracks === 2 ? "double" : "single"} main`
                      : `${c.leftTracks}→${c.rightTracks} track`
                  }${c.input.moduleId && dmap.get(c.input.moduleId) ? ` · ${dmap.get(c.input.moduleId)!.name}` : ""}${
                    c.input.stagingEnd ? " · staging" : ""
                  }`}
                </title>
              </rect>
              {c.width > 28 && (
                <text
                  x={c.x + c.width / 2}
                  y={LABEL_Y}
                  textAnchor="middle"
                  className="fill-slate-500"
                  fontSize="6"
                >
                  {c.input.moduleId ?? c.input.moduleName}
                </text>
              )}
            </g>
          );
        })}

        {/* Authored track-graph overlay (#122): sidings/spurs, turnouts, signals
            for modules whose owner published a schematic. */}
        {schem.cells.map((c) => {
          const doc = asModuleSchematic(c.input.schematic);
          if (!doc) return null;
          const feat = moduleFeatures(doc);
          const stroke = colorFor(c.input.moduleId);
          const px = (frac: number) => c.x + frac * c.width;
          return (
            <g key={`${c.input.id}-schem`}>
              {feat.extraTracks.map((t) => (
                <line
                  key={t.id}
                  x1={px(t.fromFrac)}
                  y1={laneY(t.lane)}
                  x2={px(t.toFrac)}
                  y2={laneY(t.lane)}
                  stroke={stroke}
                  strokeWidth={STROKE * 0.8}
                  strokeLinecap="round"
                  strokeDasharray={t.role === "spur" ? "2 2" : undefined}
                >
                  <title>
                    {`${t.role}${t.capacityFeet ? ` · ${t.capacityFeet} ft` : ""}`}
                  </title>
                </line>
              ))}
              {feat.turnouts.map((t) => {
                const dir = t.posFrac < 0.5 ? 1 : -1;
                return (
                  <line
                    key={t.id}
                    x1={px(t.posFrac) - dir * 4}
                    y1={laneY(t.onLane)}
                    x2={px(t.posFrac)}
                    y2={laneY(t.divergeLane)}
                    stroke={stroke}
                    strokeWidth={STROKE * 0.8}
                    strokeLinecap="round"
                  >
                    <title>{`Turnout${t.name ? ` · ${t.name}` : ""}`}</title>
                  </line>
                );
              })}
              {feat.signals.map((s) => {
                // Draw the signal parallel to the track, pointing in its facing
                // direction, so two signals at the same spot (opposite ways)
                // separate instead of stacking.
                const sx = px(s.posFrac);
                const sy = laneY(s.lane) - 3;
                const dir = s.facing === "BtoA" ? -1 : 1;
                const L = Math.max(4, c.width * 0.02);
                return (
                  <g key={s.id}>
                    <line x1={sx} y1={sy} x2={sx + dir * L} y2={sy} stroke="#94a3b8" strokeWidth={0.9} />
                    <circle cx={sx + dir * L} cy={sy} r={1.4} fill="#94a3b8" />
                    <title>{`Signal${s.name ? ` · ${s.name}` : ""} (${s.facing})`}</title>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Control points — where the main-track count changes (interlockings) */}
        {cps.map((cp, i) => (
          <g key={`cp-${i}`}>
            <circle cx={cp.x} cy={(Y0 + Y1) / 2} r={2.6} fill="#0f172a" stroke="#f59e0b" strokeWidth={1} />
            <title>
              {`Control point${cp.label ? ` · ${cp.label}` : ""}: ${cp.fromTracks} → ${cp.toTracks} track`}
            </title>
          </g>
        ))}

        {/* Endplate mismatches — red marker at the offending join */}
        {connections
          .filter((cn) => cn.status === "mismatch")
          .map((cn) => {
            const cell = schem.cells[cn.toIndex];
            return (
              <circle
                key={`mm-${cn.fromId}-${cn.toId}`}
                cx={cell.x}
                cy={Y0}
                r={3}
                fill="#7f1d1d"
                stroke="#ef4444"
                strokeWidth={1}
              >
                <title>{`Endplate mismatch: ${cn.fromConfig} ↔ ${cn.toConfig}`}</title>
              </circle>
            );
          })}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <svg width="20" height="10" className="shrink-0">
            <line x1="1" y1="5" x2="19" y2="5" stroke="#64748b" strokeWidth="1.6" />
          </svg>
          single main
        </span>
        <span className="flex items-center gap-1">
          <svg width="20" height="10" className="shrink-0">
            <line x1="1" y1="3" x2="19" y2="3" stroke="#64748b" strokeWidth="1.6" />
            <line x1="1" y1="7" x2="19" y2="7" stroke="#64748b" strokeWidth="1.6" />
          </svg>
          double main
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-amber-500" />
          control point
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-red-500 bg-red-900" />
          endplate mismatch
        </span>
        <span className="flex items-center gap-1">
          <svg width="20" height="10" className="shrink-0">
            <line x1="1" y1="7" x2="19" y2="7" stroke="#64748b" strokeWidth="1.4" />
            <line x1="6" y1="7" x2="14" y2="2" stroke="#64748b" strokeWidth="1.4" />
          </svg>
          siding / turnout
        </span>
        <span className="flex items-center gap-1">
          <svg width="16" height="10" className="shrink-0">
            <line x1="2" y1="5" x2="12" y2="5" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="13" cy="5" r="1.8" fill="#94a3b8" />
          </svg>
          signal
        </span>
        {legend.map((d) => (
          <span key={d.id} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
