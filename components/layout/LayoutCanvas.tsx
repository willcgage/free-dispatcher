/**
 * LayoutCanvas (drag-and-drop snap, phase 1) — the merged Layout Map made
 * interactive. Modules are drawn at their solved-from-joins positions; drag one
 * and, when an endplate comes within snapping distance of another module's
 * endplate, the pair highlights (green = configs match, rose = mismatch). Drop
 * to write an endplate join — the footprint solver then mates them exactly.
 *
 * Positions still come from the join graph (composeFootprint); a drag is a
 * transient on-screen offset used only to CHOOSE which endplates to connect.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { composeFootprint, type FootprintModule } from "@/lib/track/footprint";
import { endplateConfig, type LayoutJoin } from "@/lib/track/layoutJoins";
import { findSnap, type CanvasEndplate, type SnapHit } from "@/lib/track/snap";

const SNAP_RADIUS = 10; // layout inches

export function LayoutCanvas({
  modules,
  joins,
  onAddJoin,
  colorFor,
}: {
  modules: FootprintModule[];
  joins: (LayoutJoin & { status?: string })[];
  /** Create an endplate join (a snapped drop). */
  onAddJoin: (join: LayoutJoin) => void;
  colorFor?: (placementId: string) => string | undefined;
}) {
  const fp = useMemo(() => composeFootprint(modules, joins), [modules, joins]);
  const modById = useMemo(
    () => new Map(modules.map((m) => [m.id, m])),
    [modules],
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<SnapHit | null>(null);

  if (modules.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600">
        Add modules to arrange them.
      </div>
    );
  }

  // SVG space: y-up layout → y-down screen.
  const sy = (y: number) => -y;
  // Endplates of every placed module, in SVG coords, with config.
  const placedEndplates: (CanvasEndplate & { sx: number; syy: number })[] = fp.placed.flatMap(
    (m) =>
      m.endplates.map((e) => ({
        placementId: m.id,
        endplateId: e.id,
        x: e.x,
        y: sy(e.y),
        config: endplateConfig(modById.get(m.id), e.id),
        sx: e.x,
        syy: sy(e.y),
      })),
  );

  const { minX, minY, maxX, maxY } = fp.bbox;
  const pad = Math.max(24, (maxX - minX) * 0.12);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const vb = `${minX - pad} ${-(maxY + pad)} ${w + pad * 2} ${h + pad * 2}`;

  const clientToUser = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };

  const onDown = (e: React.PointerEvent, id: string) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = clientToUser(e);
    setDrag({ id, dx: 0, dy: 0 });
    setHit(null);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !startRef.current) return;
    const cur = clientToUser(e);
    const dx = cur.x - startRef.current.x;
    const dy = cur.y - startRef.current.y;
    // Dragged module's endplates, shifted; targets are everyone else's.
    const dragEps = placedEndplates
      .filter((p) => p.placementId === drag.id)
      .map((p) => ({ ...p, x: p.sx + dx, y: p.syy + dy }));
    const targetEps = placedEndplates.filter((p) => p.placementId !== drag.id);
    setHit(findSnap(dragEps, targetEps, SNAP_RADIUS));
    setDrag({ id: drag.id, dx, dy });
  };
  const onUp = () => {
    if (drag && hit) {
      onAddJoin({
        id: `usr:${hit.drag.placementId}:${hit.drag.endplateId}-${hit.target.placementId}:${hit.target.endplateId}`,
        a: { placementId: hit.drag.placementId, endplateId: hit.drag.endplateId },
        b: { placementId: hit.target.placementId, endplateId: hit.target.endplateId },
      });
    }
    setDrag(null);
    setHit(null);
    startRef.current = null;
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Arrange · drag a module, endplates snap to connect</span>
        {hit && (
          <span className={hit.compatible ? "text-emerald-400" : "text-rose-400"}>
            {hit.compatible ? "Release to connect" : "Mismatch — connect anyway, then Reverse"}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="300"
        preserveAspectRatio="xMidYMid meet"
        className="touch-none rounded-md border border-slate-700 bg-slate-950/40"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {fp.placed.map((m) => {
          const stroke = colorFor?.(m.id) ?? "#64748b";
          const off = drag?.id === m.id ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 };
          const pts = m.centerline.map((p) => `${p.x + off.dx},${sy(p.y) + off.dy}`).join(" ");
          const mid = m.centerline[Math.floor(m.centerline.length / 2)];
          return (
            <g
              key={m.id}
              onPointerDown={(e) => onDown(e, m.id)}
              style={{ cursor: drag?.id === m.id ? "grabbing" : "grab" }}
            >
              <polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth={drag?.id === m.id ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={drag && drag.id !== m.id ? 0.6 : 1}
              >
                <title>{m.moduleName ?? m.id} — drag to connect</title>
              </polyline>
              {m.endplates.map((e) => {
                const nx = Math.cos((e.heading + 90) * (Math.PI / 180));
                const ny = Math.sin((e.heading + 90) * (Math.PI / 180));
                const half = 3.2;
                return (
                  <line
                    key={e.id}
                    x1={e.x - nx * half + off.dx}
                    y1={sy(e.y - ny * half) + off.dy}
                    x2={e.x + nx * half + off.dx}
                    y2={sy(e.y + ny * half) + off.dy}
                    stroke="#94a3b8"
                    strokeWidth={1.4}
                  />
                );
              })}
              {mid && (
                <text
                  x={mid.x + off.dx}
                  y={sy(mid.y) + off.dy - 4}
                  textAnchor="middle"
                  fontSize={Math.max(w, h) * 0.03 + 2}
                  fill="#cbd5e1"
                  style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: 1, pointerEvents: "none" }}
                >
                  {m.moduleName ?? m.id}
                </text>
              )}
            </g>
          );
        })}

        {/* Snap candidate highlight */}
        {hit && (
          <g pointerEvents="none">
            {[
              { x: hit.drag.x, y: hit.drag.y },
              { x: hit.target.x, y: hit.target.y },
            ].map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={SNAP_RADIUS * 0.5}
                fill="none"
                stroke={hit.compatible ? "#34d399" : "#f43f5e"}
                strokeWidth={1.4}
              />
            ))}
            <line
              x1={hit.drag.x}
              y1={hit.drag.y}
              x2={hit.target.x}
              y2={hit.target.y}
              stroke={hit.compatible ? "#34d399" : "#f43f5e"}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          </g>
        )}
      </svg>
      <p className="mt-1 text-[10px] text-slate-600">
        Phase 1: drag a module so one of its endplates meets another module&rsquo;s — release to write a join. Positions are solved from the joins; use Reverse (⟲) in the list to turn a module around.
      </p>
    </div>
  );
}
