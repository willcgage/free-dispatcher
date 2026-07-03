/**
 * TrackBoard (#80) — the live dispatcher track view, shared by the admin console
 * and the mobile dispatch screen. Renders the session's layout (District →
 * Section → Block) with manual Block occupancy and Section allocation, kept live
 * via useTrackBoard's SSE subscription.
 */
"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { useTrackBoard, type SectionNode } from "@/lib/client/useTrackBoard";
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
  // Per-section pending allocation selection (train + direction).
  const [sel, setSel] = useState<
    Record<string, { trainId?: string; direction: Direction }>
  >({});

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

  const allocate = (section: SectionNode) => {
    const s = sel[section.id];
    if (!s?.trainId) return;
    return act(() =>
      apiSend("POST", "/api/track/allocate", {
        sectionIds: [section.id],
        trainId: s.trainId,
        direction: s.direction,
      }),
    );
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

  return (
    <div className="space-y-4">
      {layout.districts.map((d) => (
        <section key={d.id}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {d.name}
          </h3>
          <div className="space-y-2">
            {d.sections.map((section) => {
              const alloc = allocations[section.id];
              const pending = sel[section.id] ?? { direction: "AtoB" as Direction };
              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-medium text-slate-200">
                      {section.name}
                    </span>
                    {section.track && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                        {section.track}
                      </span>
                    )}
                    {alloc && (
                      <span className="ml-auto rounded bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                        {trainLabel(alloc.trainId)} · {DIR_LABEL[alloc.direction]}
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
                            title={
                              canControl ? "Toggle occupancy" : "Occupancy"
                            }
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

                  {/* Allocation control */}
                  {canControl && (
                    <div className="mt-2 flex items-center gap-2">
                      {alloc ? (
                        <button
                          disabled={busy}
                          onClick={() => release(section.id)}
                          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                          Release
                        </button>
                      ) : (
                        <>
                          <select
                            value={pending.trainId ?? ""}
                            onChange={(e) =>
                              setSel((p) => ({
                                ...p,
                                [section.id]: {
                                  ...pending,
                                  trainId: e.target.value || undefined,
                                },
                              }))
                            }
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
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
                            value={pending.direction}
                            onChange={(e) =>
                              setSel((p) => ({
                                ...p,
                                [section.id]: {
                                  ...pending,
                                  direction: e.target.value as Direction,
                                },
                              }))
                            }
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                          >
                            <option value="AtoB">A→B</option>
                            <option value="BtoA">B→A</option>
                          </select>
                          <button
                            disabled={busy || !pending.trainId}
                            onClick={() => allocate(section)}
                            className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                          >
                            Allocate
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
