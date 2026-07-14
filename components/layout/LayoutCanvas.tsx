/**
 * LayoutCanvas (drag-and-drop, flush endplate mating) — the merged Layout Map
 * made interactive. Modules are physical benchwork pieces; drag one so its free
 * endplate comes near another module's free endplate and it magnetically MATES:
 * the module rotates and slides until the two 24″ faces are FLUSH — coincident
 * and pointing into each other (the way real modules clamp). The rotation is
 * whatever the mate takes, so a corner's free face swings fully around; it is
 * never dialed in by hand, and a module can't rest with an endplate floating in
 * open space — release with no mate in range and it returns to where the solver
 * had it. Release on a mate writes the endplate join and the solver locks it in.
 *
 * All drag math is in world coordinates (y-up); the SVG flips y once at render.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { composeFootprint, type FootprintModule, type Pt } from "@/lib/track/footprint";
import { endplateConfig, type LayoutJoin } from "@/lib/track/layoutJoins";
import { bandOutline, endplateFaces } from "@/lib/track/outline";
import { flushMatePose } from "@/lib/track/mate";
import { findSnap, type CanvasEndplate, type SnapHit } from "@/lib/track/snap";

const SNAP_RADIUS = 14; // world inches — endplate faces within this mate

type Pose =
  | { kind: "free"; dx: number; dy: number }
  | { kind: "mate"; rot: number; px: number; py: number; tx: number; ty: number };

function applyPose(p: Pt, pose: Pose): Pt {
  if (pose.kind === "free") return { x: p.x + pose.dx, y: p.y + pose.dy };
  const a = (pose.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const rx = (p.x - pose.px) * c - (p.y - pose.py) * s;
  const ry = (p.x - pose.px) * s + (p.y - pose.py) * c;
  return { x: rx + pose.tx, y: ry + pose.ty };
}

export function LayoutCanvas({
  modules,
  joins,
  onAddJoin,
  colorFor,
}: {
  modules: FootprintModule[];
  joins: (LayoutJoin & { status?: string })[];
  onAddJoin: (join: LayoutJoin) => void;
  colorFor?: (placementId: string) => string | undefined;
}) {
  const fp = useMemo(() => composeFootprint(modules, joins), [modules, joins]);
  const modById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [state, setState] = useState<{ id: string; pose: Pose; hit: SnapHit | null } | null>(null);

  // Every placed module's endplates in WORLD coords, with heading + config.
  const worldEndplates: CanvasEndplate[] = useMemo(
    () =>
      fp.placed.flatMap((m) =>
        m.endplates.map((e) => ({
          placementId: m.id,
          endplateId: e.id,
          x: e.x,
          y: e.y,
          heading: e.heading,
          config: endplateConfig(modById.get(m.id), e.id),
        })),
      ),
    [fp.placed, modById],
  );
  const solvedByKey = useMemo(() => {
    const m = new Map<string, CanvasEndplate>();
    for (const e of worldEndplates) m.set(`${e.placementId}:${e.endplateId}`, e);
    return m;
  }, [worldEndplates]);
  // Endplates already clamped to a neighbour. A face mates exactly one other, so
  // an occupied endplate is neither a mate target nor a fresh mate from the
  // dragged module — otherwise a module's existing joins would re-snap the
  // instant you grabbed it and drop a duplicate join.
  const occupied = useMemo(() => {
    const s = new Set<string>();
    for (const j of joins) {
      s.add(`${j.a.placementId}:${j.a.endplateId}`);
      s.add(`${j.b.placementId}:${j.b.endplateId}`);
    }
    return s;
  }, [joins]);

  if (modules.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-600">
        Add modules to arrange them.
      </div>
    );
  }

  const sy = (y: number) => -y;
  const { minX, minY, maxX, maxY } = fp.bbox;
  const pad = Math.max(30, (maxX - minX) * 0.12);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const vb = `${minX - pad} ${-(maxY + pad)} ${w + pad * 2} ${h + pad * 2}`;
  const font = Math.max(w, h) * 0.03 + 2;

  // Pointer → world (SVG user space is screen space with y flipped).
  const toWorld = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    const u = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    return { x: u.x, y: -u.y };
  };

  const onDown = (e: React.PointerEvent, id: string) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort; a synthetic or already-released pointer is fine */
    }
    startRef.current = toWorld(e);
    setState({ id, pose: { kind: "free", dx: 0, dy: 0 }, hit: null });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!state || !startRef.current) return;
    const cur = toWorld(e);
    const dx = cur.x - startRef.current.x;
    const dy = cur.y - startRef.current.y;
    // The dragged module's FREE endplates, shifted by the raw drag; candidates
    // are every other module's free endplates. Nearest within radius wins.
    const dragged = worldEndplates
      .filter(
        (p) =>
          p.placementId === state.id &&
          !occupied.has(`${p.placementId}:${p.endplateId}`),
      )
      .map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
    const targets = worldEndplates.filter(
      (p) =>
        p.placementId !== state.id &&
        !occupied.has(`${p.placementId}:${p.endplateId}`),
    );
    const hit = findSnap(dragged, targets, SNAP_RADIUS);
    if (hit) {
      // Magnetic FLUSH mate: land the dragged endplate exactly on the target,
      // outward normals opposite — rotating the module however much that takes
      // (a corner's free face swings all the way around).
      const solvedD = solvedByKey.get(`${hit.drag.placementId}:${hit.drag.endplateId}`)!;
      const mp = flushMatePose(
        { x: solvedD.x, y: solvedD.y, heading: solvedD.heading ?? 0 },
        { x: hit.target.x, y: hit.target.y, heading: hit.target.heading ?? 0 },
      );
      setState({ id: state.id, hit, pose: { kind: "mate", ...mp } });
    } else {
      setState({ id: state.id, hit: null, pose: { kind: "free", dx, dy } });
    }
  };
  const onUp = () => {
    if (state?.hit) {
      const { drag, target } = state.hit;
      onAddJoin({
        id: `usr:${drag.placementId}:${drag.endplateId}-${target.placementId}:${target.endplateId}`,
        a: { placementId: drag.placementId, endplateId: drag.endplateId },
        b: { placementId: target.placementId, endplateId: target.endplateId },
      });
    }
    setState(null);
    startRef.current = null;
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Arrange · drag a module; endplate faces clamp together</span>
        {state?.hit && (
          <span className={state.hit.compatible ? "text-emerald-400" : "text-rose-400"}>
            {state.hit.compatible ? "Release to connect" : "Faces mate, but track counts differ — Reverse to fix"}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="320"
        preserveAspectRatio="xMidYMid meet"
        className="touch-none rounded-md border border-slate-700 bg-slate-950/40"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {fp.placed.map((m) => {
          const stroke = colorFor?.(m.id) ?? "#64748b";
          const dragging = state?.id === m.id;
          const pose: Pose | null = dragging ? state!.pose : null;
          const tp = (p: Pt) => (pose ? applyPose(p, pose) : p);
          const bandPts = bandOutline(m.centerline)
            .map(tp)
            .map((p) => `${p.x},${sy(p.y)}`)
            .join(" ");
          const track = m.centerline
            .map(tp)
            .map((p) => `${p.x},${sy(p.y)}`)
            .join(" ");
          const mid = tp(m.centerline[Math.floor(m.centerline.length / 2)]);
          const mating = dragging && state!.hit;
          return (
            <g
              key={m.id}
              onPointerDown={(e) => onDown(e, m.id)}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              {bandPts && (
                <polygon
                  points={bandPts}
                  fill={stroke}
                  fillOpacity={dragging ? 0.3 : 0.16}
                  stroke={stroke}
                  strokeOpacity={dragging ? 0.95 : 0.5}
                  strokeWidth={0.8}
                  strokeLinejoin="round"
                  opacity={state && !dragging ? 0.6 : 1}
                >
                  <title>{m.moduleName ?? m.id} — drag to connect</title>
                </polygon>
              )}
              {/* Endplate faces (24″ Free-moN interface) */}
              {endplateFaces(m.centerline).map((f, i) => {
                const p1 = tp(f.p1);
                const p2 = tp(f.p2);
                return (
                  <line
                    key={`face${i}`}
                    x1={p1.x}
                    y1={sy(p1.y)}
                    x2={p2.x}
                    y2={sy(p2.y)}
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
              <polyline
                points={track}
                fill="none"
                stroke={stroke}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Branch endplates (C/D…) — the A/B are the band ends */}
              {m.endplates
                .filter((e) => e.id !== "A" && e.id !== "B")
                .map((e) => {
                  const nx = Math.cos((e.heading + 90) * (Math.PI / 180));
                  const ny = Math.sin((e.heading + 90) * (Math.PI / 180));
                  const a = tp({ x: e.x - nx * 12, y: e.y - ny * 12 });
                  const b = tp({ x: e.x + nx * 12, y: e.y + ny * 12 });
                  return (
                    <line key={e.id} x1={a.x} y1={sy(a.y)} x2={b.x} y2={sy(b.y)} stroke="#94a3b8" strokeWidth={1.6} />
                  );
                })}
              {mid && (
                <text
                  x={mid.x}
                  y={sy(mid.y) - 4}
                  textAnchor="middle"
                  fontSize={font}
                  fill="#cbd5e1"
                  style={{ paintOrder: "stroke", stroke: "#0b1220", strokeWidth: 1, pointerEvents: "none" }}
                >
                  {m.moduleName ?? m.id}
                </text>
              )}
              {/* Highlight the joined face (where the two clamp) */}
              {mating && (
                <circle
                  cx={state!.hit!.target.x}
                  cy={sy(state!.hit!.target.y)}
                  r={7}
                  fill="none"
                  stroke={state!.hit!.compatible ? "#34d399" : "#f43f5e"}
                  strokeWidth={1.6}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-slate-600">
        Modules are physical 24″-endplate pieces; drag one so its endplate face meets another&rsquo;s and it clamps into place. Positions solve from the joins; use Reverse (⟲) in the list to turn a module around.
      </p>
    </div>
  );
}
