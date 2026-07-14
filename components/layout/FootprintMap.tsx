/**
 * FootprintMap (#175 phase 3, merged view) — the one to-scale layout map. Track
 * centre-lines are solved from the endplate-join graph (composeFootprint) and
 * drawn in world coordinates; on top of that accurate geometry it carries the
 * annotations the old node-link Footprint provided: district colours, module
 * labels, endplate-mismatch flags, and a drop-to-add target. Closures report the
 * gap a setup crew must distribute across joints.
 */
"use client";

import { useMemo, useState } from "react";
import {
  composeFootprint,
  type FootprintModule,
} from "@/lib/track/footprint";
import type { LayoutJoin } from "@/lib/track/layoutJoins";
import { bandOutline, endplateFaces } from "@/lib/track/outline";
import { MODULE_DRAG_MIME } from "@/components/layout/LayoutSchematic";

type JoinWithStatus = LayoutJoin & { status?: string };

export function FootprintMap({
  modules,
  joins,
  colorFor,
  legend,
  onDropModule,
}: {
  modules: FootprintModule[];
  joins: JoinWithStatus[];
  /** Per-placement stroke (district colour). */
  colorFor?: (placementId: string) => string | undefined;
  /** District legend swatches. */
  legend?: { id: string; name: string; color: string }[];
  /** Called with a catalog record # when one is dropped onto the map. */
  onDropModule?: (recordNumber: string) => void;
}) {
  const fp = useMemo(() => composeFootprint(modules, joins), [modules, joins]);
  const [over, setOver] = useState(false);

  const dropProps = onDropModule
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (e.dataTransfer.types.includes(MODULE_DRAG_MIME)) {
            e.preventDefault();
            setOver(true);
          }
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: React.DragEvent) => {
          setOver(false);
          const rec = e.dataTransfer.getData(MODULE_DRAG_MIME);
          if (rec) onDropModule(rec);
        },
      }
    : {};
  const ring = over ? "ring-2 ring-sky-500" : "";

  if (modules.length === 0) {
    return (
      <div
        {...dropProps}
        className={`flex h-24 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600 ${ring}`}
      >
        {onDropModule
          ? "No modules yet — drag one from the list, or use Add."
          : "Add modules to solve the layout map."}
      </div>
    );
  }

  const { minX, minY, maxX, maxY } = fp.bbox;
  const pad = 12;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  // SVG y is down; the layout uses y-up, so flip vertically.
  const vb = `${minX - pad} ${-(maxY + pad)} ${w + pad * 2} ${h + pad * 2}`;
  const fy = (y: number) => -y;
  const feet = (n: number) => `${Math.round((n / 12) * 10) / 10} ft`;
  const font = Math.max(w, h) * 0.03 + 2;

  const totalGap = fp.closures.reduce((s, c) => s + c.gapInches, 0);
  const nJoints = joins.length || 1;

  // World position of each placed endplate, for flagging mismatched joins.
  const epWorld = new Map<string, { x: number; y: number }>();
  for (const m of fp.placed)
    for (const e of m.endplates) epWorld.set(`${m.id}:${e.id}`, { x: e.x, y: e.y });
  const nameById = new Map(fp.placed.map((m) => [m.id, m.moduleName ?? m.id]));
  const mismatches = joins
    .filter((j) => j.status === "mismatch")
    .map((j) => {
      const p = epWorld.get(`${j.a.placementId}:${j.a.endplateId}`) ??
        epWorld.get(`${j.b.placementId}:${j.b.endplateId}`);
      return p
        ? { p, a: nameById.get(j.a.placementId) ?? j.a.placementId, b: nameById.get(j.b.placementId) ?? j.b.placementId }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Layout map · solved from joins</span>
        <span>
          {feet(w)} × {feet(h)}
        </span>
      </div>
      <svg
        {...dropProps}
        viewBox={vb}
        width="100%"
        height="260"
        preserveAspectRatio="xMidYMid meet"
        className={`rounded-md border border-slate-700 bg-slate-950/40 ${ring}`}
      >
        {/* Modules as physical benchwork footprints (12″ Free-moN band), the
            track centre-line drawn on top, coloured by district. */}
        {fp.placed.map((m) => {
          const stroke = colorFor?.(m.id) ?? "#64748b";
          const pts = m.centerline.map((p) => `${p.x},${fy(p.y)}`).join(" ");
          // Per-endplate authored face widths (A end / B end); band tapers between.
          const wA = m.endplates.find((e) => e.id === "A")?.width ?? 24;
          const wB = m.endplates.find((e) => e.id === "B")?.width ?? 24;
          // The authored benchwork outline if drawn, else the derived band.
          const band = m.outline ?? bandOutline(m.centerline, wA, wB);
          const bandPts = band.map((p) => `${p.x},${fy(p.y)}`).join(" ");
          const mid = m.centerline[Math.floor(m.centerline.length / 2)];
          return (
            <g key={m.id}>
              {band.length > 0 && (
                <polygon
                  points={bandPts}
                  fill={stroke}
                  fillOpacity={0.16}
                  stroke={stroke}
                  strokeOpacity={0.5}
                  strokeWidth={0.7}
                  strokeLinejoin="round"
                />
              )}
              {endplateFaces(m.centerline, wA, wB).map((f, i) => (
                <line
                  key={`face${i}`}
                  x1={f.p1.x}
                  y1={fy(f.p1.y)}
                  x2={f.p2.x}
                  y2={fy(f.p2.y)}
                  stroke={stroke}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              ))}
              <polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <title>{m.moduleName ?? m.id}</title>
              </polyline>
              {/* Branch endplates (C/D…) — the A/B faces are the band ends. */}
              {m.endplates
                .filter((e) => e.id !== "A" && e.id !== "B")
                .map((e) => {
                  const nx = Math.cos((e.heading + 90) * (Math.PI / 180));
                  const ny = Math.sin((e.heading + 90) * (Math.PI / 180));
                  const half = e.width / 2;
                  return (
                    <line
                      key={e.id}
                      x1={e.x - nx * half}
                      y1={fy(e.y - ny * half)}
                      x2={e.x + nx * half}
                      y2={fy(e.y + ny * half)}
                      stroke={stroke}
                      strokeWidth={1.6}
                    >
                      <title>{`${m.moduleName ?? m.id} · endplate ${e.id}`}</title>
                    </line>
                  );
                })}
              {mid && (
                <text
                  x={mid.x}
                  y={fy(mid.y) - font * 0.6}
                  textAnchor="middle"
                  fontSize={font}
                  fill="#cbd5e1"
                  style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: font * 0.28 }}
                >
                  {m.moduleName ?? m.id}
                </text>
              )}
            </g>
          );
        })}
        {/* Endplate mismatches — red ring at the offending join */}
        {mismatches.map((mm, i) => (
          <g key={i}>
            <circle cx={mm.p.x} cy={fy(mm.p.y)} r={font * 1.1} fill="#7f1d1d" stroke="#ef4444" strokeWidth={font * 0.22}>
              <title>{`Endplate mismatch: ${mm.a} ↔ ${mm.b}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      {legend && legend.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {legend.map((d) => (
            <span key={d.id} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
              {d.name}
            </span>
          ))}
        </div>
      )}

      {mismatches.length > 0 && (
        <div className="mt-1 rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          <span className="font-semibold">
            {mismatches.length} endplate {mismatches.length === 1 ? "mismatch" : "mismatches"}:
          </span>{" "}
          {mismatches.map((mm, i) => (
            <span key={i}>
              {i > 0 && "; "}
              {mm.a} ↔ {mm.b}
            </span>
          ))}
          <span className="text-red-400/70"> — Reverse a module (⟲) to turn it around.</span>
        </div>
      )}

      {fp.closures.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          {fp.closures.map((c, i) => {
            const clean = c.gapInches < 0.25 && c.gapDegrees < 0.5;
            return (
              <span key={c.joinId} className={clean ? "text-emerald-400" : "text-amber-400"}>
                {i > 0 && " · "}
                {clean
                  ? "Ring closes cleanly"
                  : `Closure gap ${c.gapInches.toFixed(1)} in / ${c.gapDegrees.toFixed(1)}°`}
              </span>
            );
          })}
          {totalGap >= 0.25 && (
            <span className="text-slate-500">
              {" "}
              — distributable over {nJoints} joint{nJoints > 1 ? "s" : ""} (
              {(totalGap / nJoints).toFixed(2)} in each)
            </span>
          )}
        </p>
      )}
      {fp.unplaced.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {fp.unplaced.length} module{fp.unplaced.length > 1 ? "s" : ""} not connected by any join.
        </p>
      )}
      <p className="mt-1 text-[10px] text-slate-600">
        Solved to scale from the endplate joins — shape, district colours, and mismatches in one map.
      </p>
    </div>
  );
}
