/**
 * LayoutSchematic (#115, phase 2) — a to-scale schematic of a layout's module
 * sequence, drawn from each module's geometry (straights, curves, 90° corners)
 * as an SVG polyline. Staging modules are tinted, unknown-length modules amber,
 * and endplate boundaries are marked. The path shape is computed by the pure
 * buildSchematic helper.
 */
"use client";

import { buildSchematic, type SchematicInput } from "@/lib/track/schematic";

export function LayoutSchematic({ modules }: { modules: SchematicInput[] }) {
  if (modules.length === 0) {
    return <p className="text-xs text-slate-600">No modules to draw yet.</p>;
  }

  const schem = buildSchematic(modules);
  const { bbox, totalInches } = schem;
  const w = Math.max(bbox.maxX - bbox.minX, 1);
  const h = Math.max(bbox.maxY - bbox.minY, 1);
  const pad = Math.max(w, h) * 0.06 + 6;
  const viewBox = `${bbox.minX - pad} ${bbox.minY - pad} ${w + 2 * pad} ${
    h + 2 * pad
  }`;
  const stroke = Math.max(w, h) * 0.018 + 2;
  const feet = Math.round((totalInches / 12) * 10) / 10;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>
          {modules.length} module{modules.length === 1 ? "" : "s"}
        </span>
        <span>{feet} ft total</span>
      </div>
      <svg
        viewBox={viewBox}
        width="100%"
        height="150"
        preserveAspectRatio="xMidYMid meet"
        className="rounded-md border border-slate-700 bg-slate-900"
      >
        {schem.segments.map((seg) => {
          const noLen = !(
            seg.input.lengthTotalInches && seg.input.lengthTotalInches > 0
          );
          return (
            <polyline
              key={seg.input.id}
              points={seg.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={
                seg.input.stagingEnd ? "#818cf8" : noLen ? "#f59e0b" : "#38bdf8"
              }
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>
                {`${seg.input.moduleName ?? seg.input.moduleId} · ${
                  seg.input.moduleId
                }${seg.input.geometryType ? ` · ${seg.input.geometryType}` : ""}`}
              </title>
            </polyline>
          );
        })}
        {/* Endplate boundaries. */}
        {schem.segments.map((seg) => (
          <circle
            key={`${seg.input.id}-c`}
            cx={seg.points[0].x}
            cy={seg.points[0].y}
            r={stroke * 1.1}
            fill="#0f172a"
            stroke="#475569"
            strokeWidth={stroke * 0.3}
          />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-slate-600">
        To scale, following each module&rsquo;s geometry (straights, curves, 90°
        corners). Staging tinted, unknown-length amber; curve orientation is
        approximate.
      </p>
    </div>
  );
}
