/**
 * LayoutCanvas (drag-and-drop, face-to-face snap, rotate) — the merged Layout
 * Map made interactive. Modules are physical benchwork pieces; drag one and,
 * when its endplate FACE comes alongside another module's face pointing back at
 * it, the module magnetically MATES — the two 24″ faces clamp together (the way
 * real modules connect). Release, or hit Connect, writes the endplate join and
 * the footprint solver locks it in.
 *
 * A ROTATE control turns a selected module in place: a corner module's free
 * face points off at an angle, so pure translation can't bring it around to
 * oppose a neighbour. Rotating it does — then the same mate fires. Rotation is
 * transient (a gesture aid); once a join is committed the solver owns the real
 * orientation, so nothing about the turn is persisted.
 *
 * All drag math is in world coordinates (y-up); the SVG flips y once at render.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { composeFootprint, type FootprintModule, type Pt } from "@/lib/track/footprint";
import { endplateConfig, type LayoutJoin } from "@/lib/track/layoutJoins";
import { bandOutline, endplateFaces } from "@/lib/track/outline";
import { applyXf, xfEndplate, ZERO_XF, type Xf } from "@/lib/track/arrange";
import { findFaceSnap, type CanvasEndplate, type SnapHit } from "@/lib/track/snap";

const SNAP_RADIUS = 14; // world inches — endplate faces within this mate
const ROT_STEP = 15; // degrees per rotate-button click

/** The exact "clamped" pose for a mating module: rotate about its face, slide
 * that face onto the target. */
type MatePose = { rot: number; px: number; py: number; tx: number; ty: number };

function applyMate(p: Pt, pose: MatePose): Pt {
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
  const dragRef = useRef<{ id: string; start: Pt; base: Xf } | null>(null);
  // Transient per-module manual transforms (nudge + rotate). Cleared on commit.
  const [xf, setXf] = useState<Record<string, Xf>>({});
  const [sel, setSel] = useState<string | null>(null);
  // Bump to force a re-render while dragging (dragRef is a ref, not state).
  const [, force] = useState(0);

  // Every placed module's endplates in solved WORLD coords, with heading+config.
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
  const pivotOf = useMemo(() => {
    const m = new Map<string, Pt>();
    for (const p of fp.placed)
      m.set(p.id, p.centerline[Math.floor(p.centerline.length / 2)] ?? { x: 0, y: 0 });
    return m;
  }, [fp.placed]);
  const solvedByKey = useMemo(() => {
    const m = new Map<string, CanvasEndplate>();
    for (const e of worldEndplates) m.set(`${e.placementId}:${e.endplateId}`, e);
    return m;
  }, [worldEndplates]);
  // Endplates already clamped to a neighbour. A face can only mate one other, so
  // these are neither offered as a target nor as a fresh join from the dragged
  // module — otherwise selecting an already-joined module would "re-mate" it.
  const occupied = useMemo(() => {
    const s = new Set<string>();
    for (const j of joins) {
      s.add(`${j.a.placementId}:${j.a.endplateId}`);
      s.add(`${j.b.placementId}:${j.b.endplateId}`);
    }
    return s;
  }, [joins]);

  // The module currently being manipulated (dragged, else selected).
  const activeId = dragRef.current?.id ?? sel;

  // Best mate for the active module at its current transform, plus the exact
  // clamp pose to render when it hits.
  const { hit, matePose } = useMemo((): {
    hit: SnapHit | null;
    matePose: MatePose | null;
  } => {
    if (!activeId) return { hit: null, matePose: null };
    const a = xf[activeId] ?? ZERO_XF;
    const pivot = pivotOf.get(activeId) ?? { x: 0, y: 0 };
    const dragged = worldEndplates
      .filter(
        (p) =>
          p.placementId === activeId &&
          !occupied.has(`${p.placementId}:${p.endplateId}`),
      )
      .map((p) => xfEndplate(p, a, pivot));
    const targets = worldEndplates.filter(
      (p) =>
        p.placementId !== activeId &&
        !occupied.has(`${p.placementId}:${p.endplateId}`),
    );
    const h = findFaceSnap(dragged, targets, SNAP_RADIUS);
    if (!h) return { hit: null, matePose: null };
    const solvedD = solvedByKey.get(`${h.drag.placementId}:${h.drag.endplateId}`)!;
    const rot = (h.target.heading ?? 0) + 180 - (solvedD.heading ?? 0);
    return {
      hit: h,
      matePose: { rot, px: solvedD.x, py: solvedD.y, tx: h.target.x, ty: h.target.y },
    };
  }, [activeId, xf, worldEndplates, pivotOf, solvedByKey, occupied]);

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

  const commit = (hh: SnapHit) => {
    onAddJoin({
      id: `usr:${hh.drag.placementId}:${hh.drag.endplateId}-${hh.target.placementId}:${hh.target.endplateId}`,
      a: { placementId: hh.drag.placementId, endplateId: hh.drag.endplateId },
      b: { placementId: hh.target.placementId, endplateId: hh.target.endplateId },
    });
    // The solver re-lays-out everything from the new join; drop all transient
    // transforms so nothing double-offsets.
    setXf({});
    setSel(null);
    dragRef.current = null;
  };

  const onDown = (e: React.PointerEvent, id: string) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort; a synthetic or already-released pointer is fine */
    }
    setSel(id);
    dragRef.current = { id, start: toWorld(e), base: xf[id] ?? ZERO_XF };
    force((n) => n + 1);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const cur = toWorld(e);
    setXf((prev) => ({
      ...prev,
      [d.id]: {
        rot: d.base.rot,
        dx: d.base.dx + (cur.x - d.start.x),
        dy: d.base.dy + (cur.y - d.start.y),
      },
    }));
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (hit) commit(hit);
    else force((n) => n + 1); // keep the module where it was dropped
  };

  const rotate = (delta: number) => {
    if (!sel) return;
    setXf((prev) => {
      const cur = prev[sel] ?? ZERO_XF;
      return { ...prev, [sel]: { ...cur, rot: cur.rot + delta } };
    });
  };

  const selName =
    (sel && (fp.placed.find((m) => m.id === sel)?.moduleName ?? sel)) || null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Arrange · drag to move, select to rotate; endplate faces clamp together</span>
        {hit && (
          <span className={hit.compatible ? "text-emerald-400" : "text-rose-400"}>
            {hit.compatible ? "Faces mate — Connect" : "Faces mate, but track counts differ — Reverse to fix"}
          </span>
        )}
      </div>

      {/* Rotate / connect toolbar for the selected module */}
      {selName && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-xs">
          <span className="text-slate-400">
            Selected: <span className="text-slate-200">{selName}</span>
          </span>
          <span className="ml-1 text-slate-600">rotate</span>
          <button
            type="button"
            onClick={() => rotate(-ROT_STEP)}
            title={`Rotate ${ROT_STEP}° counter-clockwise`}
            className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => rotate(ROT_STEP)}
            title={`Rotate ${ROT_STEP}° clockwise`}
            className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
          >
            ↻
          </button>
          {(xf[sel!]?.rot ?? 0) !== 0 && (
            <span className="font-mono text-slate-500">
              {(((xf[sel!]!.rot % 360) + 360) % 360).toFixed(0)}°
            </span>
          )}
          {hit && (
            <button
              type="button"
              onClick={() => commit(hit)}
              disabled={!hit.compatible}
              title={
                hit.compatible
                  ? "Connect the mating endplates"
                  : "Track counts differ — Reverse a module first"
              }
              className="rounded border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
            >
              Connect
            </button>
          )}
          <button
            type="button"
            onClick={() => setSel(null)}
            className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-slate-400 hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      )}

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
          const active = activeId === m.id;
          const selected = sel === m.id;
          const myXf = xf[m.id] ?? ZERO_XF;
          const pivot = pivotOf.get(m.id) ?? { x: 0, y: 0 };
          // When the active module has a mate, render the exact clamp; otherwise
          // render its transient manual transform.
          const tp = (p: Pt): Pt =>
            active && matePose ? applyMate(p, matePose) : applyXf(p, myXf, pivot);
          const bandPts = bandOutline(m.centerline)
            .map(tp)
            .map((p) => `${p.x},${sy(p.y)}`)
            .join(" ");
          const track = m.centerline
            .map(tp)
            .map((p) => `${p.x},${sy(p.y)}`)
            .join(" ");
          const mid = tp(m.centerline[Math.floor(m.centerline.length / 2)]);
          const mating = active && hit;
          return (
            <g
              key={m.id}
              onPointerDown={(e) => onDown(e, m.id)}
              style={{ cursor: active ? "grabbing" : "grab" }}
            >
              {bandPts && (
                <polygon
                  points={bandPts}
                  fill={stroke}
                  fillOpacity={active ? 0.3 : selected ? 0.24 : 0.16}
                  stroke={selected ? "#38bdf8" : stroke}
                  strokeOpacity={active || selected ? 0.95 : 0.5}
                  strokeWidth={selected ? 1.4 : 0.8}
                  strokeLinejoin="round"
                  opacity={activeId && !active && !selected ? 0.6 : 1}
                >
                  <title>{m.moduleName ?? m.id} — drag to move, click to select &amp; rotate</title>
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
                  cx={hit!.target.x}
                  cy={sy(hit!.target.y)}
                  r={7}
                  fill="none"
                  stroke={hit!.compatible ? "#34d399" : "#f43f5e"}
                  strokeWidth={1.6}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-slate-600">
        Modules are physical 24″-endplate pieces. Drag one so its endplate face meets another&rsquo;s and it clamps into place; for a corner, click it to select, then rotate (↺ ↻) until its face swings around to oppose a neighbour. Positions solve from the joins.
      </p>
    </div>
  );
}
