"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";

// ---- API shapes (client-side mirror of the track model) ------------------
interface LayoutRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}
interface BlockNode {
  id: string;
  name: string;
  moduleRecordNumber: string | null;
}
interface SectionNode {
  id: string;
  name: string;
  track: string | null;
  blocks: BlockNode[];
}
interface TurnoutNode {
  id: string;
  name: string;
}
interface DistrictNode {
  id: string;
  name: string;
  sections: SectionNode[];
  turnouts: TurnoutNode[];
}
interface LayoutTree extends LayoutRow {
  districts: DistrictNode[];
}

// ---- Draft shapes (the create form) --------------------------------------
interface BlockDraft {
  name: string;
  moduleRecordNumber: string;
}
interface SectionDraft {
  name: string;
  track: string;
  blocks: BlockDraft[];
}
interface TurnoutDraft {
  name: string;
}
interface DistrictDraft {
  name: string;
  sections: SectionDraft[];
  turnouts: TurnoutDraft[];
}
interface LayoutDraft {
  name: string;
  description: string;
  districts: DistrictDraft[];
}

const EMPTY_DRAFT: LayoutDraft = { name: "", description: "", districts: [] };

const input =
  "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";
const smInput =
  "w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100 placeholder-slate-500";
const addBtn =
  "rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800";
const xBtn = "px-1.5 text-slate-500 hover:text-red-400";

export default function AdminLayouts() {
  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [trees, setTrees] = useState<Record<string, LayoutTree>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sessionLayoutId, setSessionLayoutId] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [draft, setDraft] = useState<LayoutDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ layouts }, session] = await Promise.all([
      apiGet<{ layouts: LayoutRow[] }>("/api/layouts"),
      apiGet<{ session: { layoutId: string | null } | null }>("/api/session"),
    ]);
    setLayouts(layouts);
    setSessionLayoutId(session.session?.layoutId ?? null);
    setHasSession(session.session != null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggleTree(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!trees[id]) {
      try {
        const { layout } = await apiGet<{ layout: LayoutTree }>(
          `/api/layouts/${id}`,
        );
        setTrees((prev) => ({ ...prev, [id]: layout }));
      } catch {
        /* best-effort */
      }
    }
  }

  async function attachToSession(id: string) {
    setBusy(true);
    try {
      await apiSend("PATCH", "/api/session", { layoutId: id });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "attach failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- draft mutations ---------------------------------------------------
  const mutate = (fn: (d: LayoutDraft) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  function buildPayload(d: LayoutDraft) {
    return {
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      districts: d.districts
        .filter((di) => di.name.trim())
        .map((di) => ({
          name: di.name.trim(),
          sections: di.sections
            .filter((s) => s.name.trim())
            .map((s) => ({
              name: s.name.trim(),
              track: s.track.trim() || undefined,
              blocks: s.blocks
                .filter((b) => b.name.trim())
                .map((b) => ({
                  name: b.name.trim(),
                  moduleRecordNumber: b.moduleRecordNumber.trim() || undefined,
                })),
            })),
          turnouts: di.turnouts
            .filter((t) => t.name.trim())
            .map((t) => ({ name: t.name.trim() })),
        })),
    };
  }

  async function createLayout(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", "/api/layouts", buildPayload(draft));
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Layouts</h1>
      <p className="text-sm text-slate-400">
        A layout is the reusable track model — Districts, Sections and Blocks —
        that a session runs on. Author it once here, then attach it to your
        session.
      </p>

      {/* Existing layouts */}
      <Panel title={`Layouts (${layouts.length})`}>
        {layouts.length === 0 ? (
          <p className="text-sm text-slate-400">
            No layouts yet. Create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {layouts.map((l) => {
              const isCurrent = l.id === sessionLayoutId;
              const tree = trees[l.id];
              return (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => toggleTree(l.id)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <span className="text-slate-500">
                        {expanded.has(l.id) ? "▾" : "▸"}
                      </span>
                      <span className="truncate font-medium text-slate-100">
                        {l.name}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                          in session
                        </span>
                      )}
                    </button>
                    <button
                      disabled={busy || isCurrent || !hasSession}
                      onClick={() => attachToSession(l.id)}
                      title={
                        !hasSession
                          ? "Start a session first"
                          : "Attach this layout to the active session"
                      }
                      className="shrink-0 rounded-md border border-sky-700/60 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-900/30 disabled:opacity-40"
                    >
                      {isCurrent ? "Current" : "Use in session"}
                    </button>
                  </div>
                  {expanded.has(l.id) && (
                    <div className="mt-2 pl-5 text-sm">
                      {!tree ? (
                        <p className="text-slate-500">Loading…</p>
                      ) : tree.districts.length === 0 ? (
                        <p className="text-slate-500">No districts yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {tree.districts.map((d) => (
                            <li key={d.id}>
                              <div className="font-medium text-slate-300">
                                {d.name}
                              </div>
                              <ul className="ml-3 space-y-0.5 text-slate-400">
                                {d.sections.map((s) => (
                                  <li key={s.id}>
                                    <span className="text-slate-300">
                                      {s.name}
                                    </span>
                                    {s.track && (
                                      <span className="ml-1 text-xs text-slate-500">
                                        ({s.track})
                                      </span>
                                    )}
                                    <span className="ml-2 text-xs text-slate-500">
                                      {s.blocks.map((b) => b.name).join(" · ") ||
                                        "no blocks"}
                                    </span>
                                  </li>
                                ))}
                                {d.turnouts.length > 0 && (
                                  <li className="text-xs text-slate-500">
                                    Turnouts:{" "}
                                    {d.turnouts.map((t) => t.name).join(" · ")}
                                  </li>
                                )}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Create a layout */}
      <Panel title="New layout">
        <form onSubmit={createLayout} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Layout name * (e.g. Spring Meet mainline)"
              value={draft.name}
              onChange={(e) => mutate((d) => (d.name = e.target.value))}
            />
            <input
              className={input}
              placeholder="Description (optional)"
              value={draft.description}
              onChange={(e) => mutate((d) => (d.description = e.target.value))}
            />
          </div>

          {/* Districts */}
          <div className="space-y-3">
            {draft.districts.map((district, di) => (
              <div
                key={di}
                className="rounded-md border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-slate-500">
                    District
                  </span>
                  <input
                    className={smInput}
                    placeholder="District name"
                    value={district.name}
                    onChange={(e) =>
                      mutate((d) => (d.districts[di].name = e.target.value))
                    }
                  />
                  <button
                    type="button"
                    className={xBtn}
                    onClick={() => mutate((d) => d.districts.splice(di, 1))}
                    title="Remove district"
                  >
                    ✕
                  </button>
                </div>

                {/* Sections */}
                <div className="mt-2 space-y-2 pl-4">
                  {district.sections.map((section, si) => (
                    <div
                      key={si}
                      className="rounded border border-slate-800/80 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-slate-500">
                          Section
                        </span>
                        <input
                          className={smInput}
                          placeholder="Section name"
                          value={section.name}
                          onChange={(e) =>
                            mutate(
                              (d) =>
                                (d.districts[di].sections[si].name =
                                  e.target.value),
                            )
                          }
                        />
                        <input
                          className={`${smInput} max-w-[8rem]`}
                          placeholder="Track (opt)"
                          value={section.track}
                          onChange={(e) =>
                            mutate(
                              (d) =>
                                (d.districts[di].sections[si].track =
                                  e.target.value),
                            )
                          }
                        />
                        <button
                          type="button"
                          className={xBtn}
                          onClick={() =>
                            mutate((d) =>
                              d.districts[di].sections.splice(si, 1),
                            )
                          }
                          title="Remove section"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Blocks */}
                      <div className="mt-1.5 space-y-1 pl-4">
                        {section.blocks.map((block, bi) => (
                          <div key={bi} className="flex items-center gap-2">
                            <span className="text-xs uppercase text-slate-500">
                              Block
                            </span>
                            <input
                              className={smInput}
                              placeholder="Block name"
                              value={block.name}
                              onChange={(e) =>
                                mutate(
                                  (d) =>
                                    (d.districts[di].sections[si].blocks[
                                      bi
                                    ].name = e.target.value),
                                )
                              }
                            />
                            <input
                              className={`${smInput} max-w-[9rem]`}
                              placeholder="Module # (opt)"
                              value={block.moduleRecordNumber}
                              onChange={(e) =>
                                mutate(
                                  (d) =>
                                    (d.districts[di].sections[si].blocks[
                                      bi
                                    ].moduleRecordNumber = e.target.value),
                                )
                              }
                            />
                            <button
                              type="button"
                              className={xBtn}
                              onClick={() =>
                                mutate((d) =>
                                  d.districts[di].sections[si].blocks.splice(
                                    bi,
                                    1,
                                  ),
                                )
                              }
                              title="Remove block"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className={addBtn}
                          onClick={() =>
                            mutate((d) =>
                              d.districts[di].sections[si].blocks.push({
                                name: "",
                                moduleRecordNumber: "",
                              }),
                            )
                          }
                        >
                          + Block
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={addBtn}
                    onClick={() =>
                      mutate((d) =>
                        d.districts[di].sections.push({
                          name: "",
                          track: "",
                          blocks: [],
                        }),
                      )
                    }
                  >
                    + Section
                  </button>
                </div>

                {/* Turnouts */}
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-4">
                  <span className="text-xs uppercase text-slate-500">
                    Turnouts
                  </span>
                  {district.turnouts.map((to, ti) => (
                    <span key={ti} className="flex items-center gap-1">
                      <input
                        className={`${smInput} max-w-[8rem]`}
                        placeholder="Name"
                        value={to.name}
                        onChange={(e) =>
                          mutate(
                            (d) =>
                              (d.districts[di].turnouts[ti].name =
                                e.target.value),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={xBtn}
                        onClick={() =>
                          mutate((d) => d.districts[di].turnouts.splice(ti, 1))
                        }
                        title="Remove turnout"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className={addBtn}
                    onClick={() =>
                      mutate((d) => d.districts[di].turnouts.push({ name: "" }))
                    }
                  >
                    + Turnout
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={addBtn}
              onClick={() =>
                mutate((d) =>
                  d.districts.push({ name: "", sections: [], turnouts: [] }),
                )
              }
            >
              + District
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <button
            disabled={busy || !draft.name.trim()}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create layout"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
