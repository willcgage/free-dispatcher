/**
 * TrackBoard (#80) — the live dispatcher track view, shared by the admin console
 * and the mobile dispatch screen. Renders the session's layout (District →
 * Section → Block) with manual Block occupancy and Section allocation, kept live
 * via useTrackBoard's SSE subscription.
 *
 * Allocation is selection-based: tick one or more Sections, then grant them to a
 * train + direction as a single route. The server allocates atomically and
 * rejects a route that spans more than one District or hits an already-allocated
 * Section.
 */
"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { useTrackBoard } from "@/lib/client/useTrackBoard";
import {
  deriveSectionAspect,
  ASPECT_META,
  ASPECT_ORDER,
} from "@/lib/track/signals";
import type { TrainRow } from "@/lib/client/types";

type Direction = "AtoB" | "BtoA";
const DIR_LABEL: Record<Direction, string> = { AtoB: "A→B", BtoA: "B→A" };

export function TrackBoard({
  trains,
  canControl,
}: {
  trains: TrainRow[];
  canControl: boolean;
}) {
  const { layout, occupancy, allocations, loading, refresh } = useTrackBoard();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [routeTrainId, setRouteTrainId] = useState("");
  const [routeDir, setRouteDir] = useState<Direction>("AtoB");

  const trainLabel = (id: string) => {
    const t = trains.find((x) => x.id === id);
    return t ? `${t.number}${t.name ? " · " + t.name : ""}` : "train";
  };

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "action failed");
    } finally {
      setBusy(false);
    }
  }

  const toggleBlock = (blockId: string, occupied: boolean) =>
    act(() =>
      apiSend("POST", "/api/track/occupancy", { blockId, occupied: !occupied }),
    );

  const toggleSelect = (sectionId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

  const allocateRoute = () => {
    if (!routeTrainId || selected.size === 0) return;
    return act(async () => {
      await apiSend("POST", "/api/track/allocate", {
        sectionIds: [...selected],
        trainId: routeTrainId,
        direction: routeDir,
      });
      setSelected(new Set());
      setRouteTrainId("");
    });
  };

  const release = (sectionId: string) =>
    act(() => apiSend("POST", "/api/track/release", { sectionId }));

  if (loading) {
    return <p className="text-sm text-slate-400">Loading track…</p>;
  }
  if (!layout) {
    return (
      <p className="text-sm text-slate-400">
        No layout attached to this session. Attach one from{" "}
        <a href="/admin/layouts" className="text-sky-400 hover:underline">
          Layouts
        </a>
        .
      </p>
    );
  }

  const occupiedBlocks = new Set(
    Object.values(occupancy)
      .filter((o) => o.occupied)
      .map((o) => o.blockId),
  );

  return (
    <div className="space-y-4">
      {/* Signal legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span className="font-medium text-slate-500">Signals:</span>
        {ASPECT_ORDER.map((a) => (
          <span key={a} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${ASPECT_META[a].dot}`} />
            {ASPECT_META[a].label}
          </span>
        ))}
      </div>

      {/* Route allocation bar — appears once sections are selected. */}
      {canControl && selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-sky-800/60 bg-slate-900 p-2.5 shadow-lg">
          <span className="text-sm font-medium text-slate-200">
            {selected.size} section{selected.size > 1 ? "s" : ""} →
          </span>
          <select
            value={routeTrainId}
            onChange={(e) => setRouteTrainId(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            <option value="">Train…</option>
            {trains.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number}
                {t.name ? ` · ${t.name}` : ""}
              </option>
            ))}
          </select>
          <select
            value={routeDir}
            onChange={(e) => setRouteDir(e.target.value as Direction)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            <option value="AtoB">A→B</option>
            <option value="BtoA">B→A</option>
          </select>
          <button
            disabled={busy || !routeTrainId}
            onClick={allocateRoute}
            className="rounded-md bg-sky-600 px-3 py-1 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Allocate route
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            Clear
          </button>
        </div>
      )}

      {layout.districts.map((d) => (
        <section key={d.id}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {d.name}
          </h3>
          <div className="space-y-2">
            {d.sections.map((section) => {
              const alloc = allocations[section.id];
              const isSelected = selected.has(section.id);
              const aspect = deriveSectionAspect(
                section.blocks.map((b) => b.id),
                occupiedBlocks,
                !!alloc,
              );
              return (
                <div
                  key={section.id}
                  className={`rounded-lg border bg-slate-900/40 p-3 ${
                    isSelected ? "border-sky-600" : "border-slate-800"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${ASPECT_META[aspect].dot}`}
                      title={`Signal: ${ASPECT_META[aspect].label}`}
                    />
                    {canControl && !alloc && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(section.id)}
                        title="Select for a route"
                        className="h-4 w-4 accent-sky-500"
                      />
                    )}
                    <span className="font-medium text-slate-200">
                      {section.name}
                    </span>
                    {section.track && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                        {section.track}
                      </span>
                    )}
                    {alloc && (
                      <span className="ml-auto flex items-center gap-2">
                        <span className="rounded bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                          {trainLabel(alloc.trainId)} · {DIR_LABEL[alloc.direction]}
                        </span>
                        {canControl && (
                          <button
                            disabled={busy}
                            onClick={() => release(section.id)}
                            className="rounded-md border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            Release
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Blocks */}
                  <div className="flex flex-wrap gap-1.5">
                    {section.blocks.length === 0 ? (
                      <span className="text-xs text-slate-600">no blocks</span>
                    ) : (
                      section.blocks.map((b) => {
                        const occ = occupancy[b.id]?.occupied ?? false;
                        return (
                          <button
                            key={b.id}
                            disabled={!canControl || busy}
                            onClick={() => toggleBlock(b.id, occ)}
                            title={canControl ? "Toggle occupancy" : "Occupancy"}
                            className={`rounded px-2 py-1 text-xs font-medium transition ${
                              occ
                                ? "bg-red-600/30 text-red-200 ring-1 ring-red-600/50"
                                : "bg-slate-800 text-slate-300"
                            } ${canControl ? "hover:brightness-125" : "cursor-default"} disabled:opacity-60`}
                          >
                            {b.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
