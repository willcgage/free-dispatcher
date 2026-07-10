/**
 * FootprintMap (#175 phase 3) — the accurate to-scale layout map, solved from
 * the endplate-join graph (composeFootprint). Each module's centre-line is
 * drawn in world coordinates; endplates are ticks; closures report the gap a
 * setup crew must distribute across joints.
 */
"use client";

import { useMemo } from "react";
import {
  composeFootprint,
  type FootprintModule,
} from "@/lib/track/footprint";
import type { LayoutJoin } from "@/lib/track/layoutJoins";

export function FootprintMap({
  modules,
  joins,
  colorFor,
}: {
  modules: FootprintModule[];
  joins: LayoutJoin[];
  /** Optional per-placement stroke (district colour). */
  colorFor?: (placementId: string) => string | undefined;
}) {
  const fp = useMemo(() => composeFootprint(modules, joins), [modules, joins]);

  if (modules.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600">
        Add modules to solve the layout map.
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

  const totalGap = fp.closures.reduce((s, c) => s + c.gapInches, 0);
  const nJoints = joins.length || 1;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Layout map · solved from joins</span>
        <span>
          {feet(w)} × {feet(h)}
        </span>
      </div>
      <svg
        viewBox={vb}
        width="100%"
        height="240"
        preserveAspectRatio="xMidYMid meet"
        className="rounded bg-slate-950/40"
      >
        {/* Module centre-lines */}
        {fp.placed.map((m) => {
          const stroke = colorFor?.(m.id) ?? "#64748b";
          const pts = m.centerline.map((p) => `${p.x},${fy(p.y)}`).join(" ");
          return (
            <g key={m.id}>
              <polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <title>{m.moduleName ?? m.id}</title>
              </polyline>
              {/* Endplate ticks */}
              {m.endplates.map((e) => {
                const nx = Math.cos((e.heading + 90) * (Math.PI / 180));
                const ny = Math.sin((e.heading + 90) * (Math.PI / 180));
                const half = 3;
                return (
                  <line
                    key={e.id}
                    x1={e.x - nx * half}
                    y1={fy(e.y - ny * half)}
                    x2={e.x + nx * half}
                    y2={fy(e.y + ny * half)}
                    stroke={stroke}
                    strokeWidth={1.2}
                  >
                    <title>{`${m.moduleName ?? m.id} · endplate ${e.id}`}</title>
                  </line>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Closure report */}
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
          {fp.unplaced.length} module{fp.unplaced.length > 1 ? "s" : ""} not
          connected by any join.
        </p>
      )}
    </div>
  );
}
