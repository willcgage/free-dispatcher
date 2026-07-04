/**
 * LayoutSchematic (#115, phase 2) — a to-scale schematic of a layout's module
 * sequence, drawn from each module's geometry (straights, curves, 90° corners)
 * as an SVG polyline. Staging modules are tinted, unknown-length modules amber,
 * and endplate boundaries are marked. The path shape is computed by the pure
 * buildSchematic helper.
 */
"use client";

import { useState } from "react";
import { buildSchematic, type SchematicInput } from "@/lib/track/schematic";
import { endplateConnections } from "@/lib/track/endplates";

/** Drag payload MIME for dropping a catalog module onto the schematic. */
export const MODULE_DRAG_MIME = "application/x-fd-module";

export function LayoutSchematic({
  modules,
  onDropModule,
}: {
  modules: SchematicInput[];
  /** Called with a catalog record # when one is dropped onto the schematic. */
  onDropModule?: (recordNumber: string) => void;
}) {
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
        className={`flex h-16 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600 ${ring}`}
      >
        {onDropModule
          ? "No modules yet — drag one from the list, or use Add."
          : "No modules to draw yet."}
      </div>
    );
  }

  const schem = buildSchematic(modules);
  const { bbox, totalInches } = schem;
  // Endplate connection checks (#115): the join before segment i is
  // connections[i-1]. Mismatches (e.g. single↔double) are flagged.
  const connections = endplateConnections(modules);
  const mismatches = connections.filter((c) => c.status === "mismatch");
  const label = (i: number) => modules[i]?.moduleName ?? modules[i]?.moduleId;
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
        {...dropProps}
        viewBox={viewBox}
        width="100%"
        height="150"
        preserveAspectRatio="xMidYMid meet"
        className={`rounded-md border border-slate-700 bg-slate-900 ${ring}`}
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
        {/* Endplate boundaries; joins tinted red on a track-config mismatch. */}
        {schem.segments.map((seg, i) => {
          const conn = i > 0 ? connections[i - 1] : undefined;
          const bad = conn?.status === "mismatch";
          return (
            <circle
              key={`${seg.input.id}-c`}
              cx={seg.points[0].x}
              cy={seg.points[0].y}
              r={stroke * (bad ? 1.5 : 1.1)}
              fill={bad ? "#7f1d1d" : "#0f172a"}
              stroke={bad ? "#ef4444" : "#475569"}
              strokeWidth={stroke * (bad ? 0.5 : 0.3)}
            >
              {conn && (
                <title>
                  {`${label(conn.fromIndex)} (${conn.fromConfig ?? "?"}) ↔ ${label(
                    conn.toIndex,
                  )} (${conn.toConfig ?? "?"})${bad ? " — mismatch" : ""}`}
                </title>
              )}
            </circle>
          );
        })}
      </svg>
      {mismatches.length > 0 && (
        <div className="mt-1 rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          <span className="font-semibold">
            {mismatches.length} endplate{" "}
            {mismatches.length === 1 ? "mismatch" : "mismatches"}:
          </span>{" "}
          {mismatches.map((c, i) => (
            <span key={`${c.fromId}-${c.toId}`}>
              {i > 0 && "; "}
              {label(c.fromIndex)} ({c.fromConfig}) ↔ {label(c.toIndex)} (
              {c.toConfig})
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-slate-600">
        To scale, following each module&rsquo;s geometry (straights, curves, 90°
        corners). Staging tinted, unknown-length amber; red joins flag an endplate
        track-config mismatch; curve orientation is approximate.
      </p>
    </div>
  );
}
