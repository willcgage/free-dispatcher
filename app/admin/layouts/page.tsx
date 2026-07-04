"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import { moduleMatches } from "@/lib/client/moduleSearch";
import { LayoutSchematic } from "@/components/layout/LayoutSchematic";
import type { CatalogModule } from "@/lib/client/types";
import type { StagingEnd } from "@/lib/db/schema";

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
interface LayoutModuleNode {
  id: string;
  moduleId: string;
  positionIndex: number;
  stagingEnd: StagingEnd | null;
  moduleName: string | null;
  lengthTotalInches: number | null;
  mainlineLengthInches: number | null;
  hasMss: boolean | null;
  geometryType: string | null;
  geometryDegrees: number | null;
}
interface LayoutTree extends LayoutRow {
  modules: LayoutModuleNode[];
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
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [modQuery, setModQuery] = useState<Record<string, string>>({});
  const [modChecked, setModChecked] = useState<Record<string, string[]>>({});
  const [drag, setDrag] = useState<{ layoutId: string; from: number } | null>(
    null,
  );
  const [dragSection, setDragSection] = useState<{
    layoutId: string;
    sectionId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ layouts }, session, cat] = await Promise.all([
      apiGet<{ layouts: LayoutRow[] }>("/api/layouts"),
      apiGet<{ session: { layoutId: string | null } | null }>("/api/session"),
      apiGet<{ modules: CatalogModule[] }>("/api/modules/catalog").catch(() => ({
        modules: [] as CatalogModule[],
      })),
    ]);
    setLayouts(layouts);
    setSessionLayoutId(session.session?.layoutId ?? null);
    setHasSession(session.session != null);
    setCatalog(cat.modules);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reloadTree = useCallback(async (id: string) => {
    try {
      const { layout } = await apiGet<{ layout: LayoutTree }>(
        `/api/layouts/${id}`,
      );
      setTrees((prev) => ({ ...prev, [id]: layout }));
    } catch {
      /* best-effort */
    }
  }, []);

  async function toggleTree(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!trees[id]) await reloadTree(id);
  }

  const qOf = (id: string) => modQuery[id] ?? "";
  const checkedOf = (id: string) => modChecked[id] ?? [];

  function toggleCheck(id: string, rec: string) {
    setModChecked((p) => {
      const cur = p[id] ?? [];
      return {
        ...p,
        [id]: cur.includes(rec) ? cur.filter((r) => r !== rec) : [...cur, rec],
      };
    });
  }

  async function addModules(layoutId: string) {
    const ids = checkedOf(layoutId);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/modules", { layoutId, moduleIds: ids });
      setModChecked((p) => ({ ...p, [layoutId]: [] }));
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "add failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStaging(
    layoutId: string,
    id: string,
    stagingEnd: "" | StagingEnd,
  ) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/modules/${id}`, {
        stagingEnd: stagingEnd || null,
      });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeModule(layoutId: string, id: string) {
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/modules/${id}`);
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "remove failed");
    } finally {
      setBusy(false);
    }
  }

  /** Move a section to a district at an index; posts the full new arrangement. */
  async function moveSection(
    layoutId: string,
    tree: LayoutTree,
    sectionId: string,
    toDistrictId: string,
    toIndex: number,
  ) {
    const byDistrict = new Map<string, string[]>();
    for (const d of tree.districts) byDistrict.set(d.id, d.sections.map((s) => s.id));
    for (const ids of byDistrict.values()) {
      const idx = ids.indexOf(sectionId);
      if (idx >= 0) ids.splice(idx, 1);
    }
    const target = byDistrict.get(toDistrictId) ?? [];
    target.splice(Math.min(Math.max(toIndex, 0), target.length), 0, sectionId);
    byDistrict.set(toDistrictId, target);

    const placements: { id: string; districtId: string; position: number }[] = [];
    for (const [districtId, ids] of byDistrict)
      ids.forEach((id, position) => placements.push({ id, districtId, position }));

    setBusy(true);
    try {
      await apiSend("POST", "/api/track/sections/arrange", {
        sections: placements,
      });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "move failed");
    } finally {
      setBusy(false);
    }
  }

  /** Reorder the module sequence after a drag from index → to index. */
  async function moveModule(
    layoutId: string,
    ids: string[],
    from: number,
    to: number,
  ) {
    if (from === to || from < 0 || to < 0) return;
    const orderedIds = [...ids];
    const [moved] = orderedIds.splice(from, 1);
    orderedIds.splice(to, 0, moved);
    setBusy(true);
    try {
      await apiSend("POST", "/api/modules/reorder", { layoutId, orderedIds });
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "reorder failed");
    } finally {
      setBusy(false);
    }
  }

  async function setSessionLayout(id: string | null) {
    setBusy(true);
    try {
      await apiSend("PATCH", "/api/session", { layoutId: id });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "update failed");
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
                    {isCurrent ? (
                      <button
                        disabled={busy}
                        onClick={() => setSessionLayout(null)}
                        title="Remove this layout from the active session"
                        className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Remove from session
                      </button>
                    ) : (
                      <button
                        disabled={busy || !hasSession}
                        onClick={() => setSessionLayout(l.id)}
                        title={
                          !hasSession
                            ? "Start a session first"
                            : sessionLayoutId
                              ? "Switch the session to this layout"
                              : "Attach this layout to the active session"
                        }
                        className="shrink-0 rounded-md border border-sky-700/60 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-900/30 disabled:opacity-40"
                      >
                        {sessionLayoutId ? "Switch to this" : "Use in session"}
                      </button>
                    )}
                  </div>
                  {expanded.has(l.id) && (
                    <div className="mt-2 space-y-3 pl-5 text-sm">
                      {!tree ? (
                        <p className="text-slate-500">Loading…</p>
                      ) : (
                        <>
                          {/* Module sequence */}
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Modules ({tree.modules.length})
                            </div>
                            {tree.modules.length > 0 ? (
                              <ul className="mb-2 space-y-1">
                                {tree.modules.map((m, i) => (
                                  <li
                                    key={m.id}
                                    draggable={!busy}
                                    onDragStart={() =>
                                      setDrag({ layoutId: l.id, from: i })
                                    }
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                      if (drag && drag.layoutId === l.id)
                                        moveModule(
                                          l.id,
                                          tree.modules.map((x) => x.id),
                                          drag.from,
                                          i,
                                        );
                                      setDrag(null);
                                    }}
                                    onDragEnd={() => setDrag(null)}
                                    className={`flex items-center gap-2 rounded border border-slate-700 bg-slate-800/60 px-2 py-1 ${
                                      drag?.layoutId === l.id && drag.from === i
                                        ? "opacity-50"
                                        : ""
                                    }`}
                                  >
                                    <span
                                      className="shrink-0 cursor-grab select-none text-slate-600"
                                      title="Drag to reorder"
                                    >
                                      ⠿
                                    </span>
                                    <span className="w-5 shrink-0 text-right text-xs text-slate-500">
                                      {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-slate-200">
                                      {m.moduleName ?? m.moduleId}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs text-slate-500">
                                      {m.moduleId}
                                    </span>
                                    <select
                                      value={m.stagingEnd ?? ""}
                                      onChange={(e) =>
                                        setStaging(
                                          l.id,
                                          m.id,
                                          e.target.value as "" | StagingEnd,
                                        )
                                      }
                                      title="Staging end"
                                      className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                    >
                                      <option value="">—</option>
                                      <option value="A">Stg A</option>
                                      <option value="B">Stg B</option>
                                    </select>
                                    <button
                                      disabled={busy}
                                      onClick={() => removeModule(l.id, m.id)}
                                      title="Remove"
                                      className="shrink-0 text-xs text-red-400 hover:text-red-300"
                                    >
                                      ✕
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mb-2 text-xs text-slate-600">
                                No modules assigned yet.
                              </p>
                            )}

                            {/* Add from the catalog (multi-select) */}
                            {catalog.length === 0 ? (
                              <p className="text-xs text-slate-600">
                                Catalog empty —{" "}
                                <a
                                  href="/admin/modules"
                                  className="text-sky-400 hover:underline"
                                >
                                  sync it in Modules
                                </a>
                                .
                              </p>
                            ) : (
                              <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2">
                                <div className="mb-2 flex items-center gap-2">
                                  <input
                                    className={smInput}
                                    placeholder="Search name, #, category…"
                                    value={qOf(l.id)}
                                    onChange={(e) =>
                                      setModQuery((p) => ({
                                        ...p,
                                        [l.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    disabled={busy || checkedOf(l.id).length === 0}
                                    onClick={() => addModules(l.id)}
                                    className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                                  >
                                    Add {checkedOf(l.id).length || ""}
                                  </button>
                                </div>
                                <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                                  {catalog
                                    .filter((m) => moduleMatches(m, qOf(l.id)))
                                    .slice(0, 200)
                                    .map((m) => {
                                      const isAssigned = tree.modules.some(
                                        (x) => x.moduleId === m.recordNumber,
                                      );
                                      const isChecked = checkedOf(l.id).includes(
                                        m.recordNumber,
                                      );
                                      return (
                                        <li key={m.recordNumber}>
                                          <label
                                            className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${
                                              isAssigned
                                                ? "opacity-50"
                                                : "cursor-pointer hover:bg-slate-800/60"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              disabled={isAssigned || busy}
                                              checked={isAssigned || isChecked}
                                              onChange={() =>
                                                toggleCheck(l.id, m.recordNumber)
                                              }
                                              className="h-4 w-4 accent-sky-500"
                                            />
                                            <span className="min-w-0 flex-1 truncate text-slate-200">
                                              {m.moduleName}
                                            </span>
                                            {m.owner && (
                                              <span className="hidden shrink-0 truncate text-xs text-slate-500 sm:inline">
                                                {m.owner}
                                              </span>
                                            )}
                                            <span className="shrink-0 font-mono text-xs text-slate-500">
                                              {m.recordNumber}
                                            </span>
                                            {m.category && (
                                              <span className="shrink-0 text-xs text-slate-600">
                                                {m.category}
                                              </span>
                                            )}
                                            {isAssigned && (
                                              <span className="shrink-0 text-xs text-emerald-400">
                                                added
                                              </span>
                                            )}
                                          </label>
                                        </li>
                                      );
                                    })}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Schematic (to-scale) */}
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Schematic
                            </div>
                            <LayoutSchematic modules={tree.modules} />
                          </div>

                          {/* Track */}
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Track
                            </div>
                            {tree.districts.length === 0 ? (
                              <p className="text-slate-500">No districts yet.</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {tree.districts.map((d) => (
                                  <li
                                    key={d.id}
                                    onDragOver={(e) => {
                                      if (dragSection?.layoutId === l.id)
                                        e.preventDefault();
                                    }}
                                    onDrop={() => {
                                      if (dragSection?.layoutId === l.id)
                                        moveSection(
                                          l.id,
                                          tree,
                                          dragSection.sectionId,
                                          d.id,
                                          d.sections.length,
                                        );
                                      setDragSection(null);
                                    }}
                                    className={`rounded ${
                                      dragSection?.layoutId === l.id
                                        ? "ring-1 ring-slate-700"
                                        : ""
                                    }`}
                                  >
                                    <div className="font-medium text-slate-300">
                                      {d.name}
                                    </div>
                                    <ul className="ml-3 space-y-0.5 text-slate-400">
                                      {d.sections.map((s, si) => (
                                        <li
                                          key={s.id}
                                          draggable={!busy}
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            setDragSection({
                                              layoutId: l.id,
                                              sectionId: s.id,
                                            });
                                          }}
                                          onDragOver={(e) => {
                                            if (dragSection?.layoutId === l.id)
                                              e.preventDefault();
                                          }}
                                          onDrop={(e) => {
                                            e.stopPropagation();
                                            if (
                                              dragSection?.layoutId === l.id &&
                                              dragSection.sectionId !== s.id
                                            )
                                              moveSection(
                                                l.id,
                                                tree,
                                                dragSection.sectionId,
                                                d.id,
                                                si,
                                              );
                                            setDragSection(null);
                                          }}
                                          onDragEnd={() => setDragSection(null)}
                                          className={`flex items-center gap-1.5 rounded px-1 ${
                                            dragSection?.sectionId === s.id
                                              ? "opacity-50"
                                              : "hover:bg-slate-800/40"
                                          }`}
                                        >
                                          <span className="cursor-grab select-none text-slate-600">
                                            ⠿
                                          </span>
                                          <span className="text-slate-300">
                                            {s.name}
                                          </span>
                                          {s.track && (
                                            <span className="text-xs text-slate-500">
                                              ({s.track})
                                            </span>
                                          )}
                                          <span className="text-xs text-slate-500">
                                            {s.blocks
                                              .map((b) => b.name)
                                              .join(" · ") || "no blocks"}
                                          </span>
                                        </li>
                                      ))}
                                      {d.sections.length === 0 && (
                                        <li className="text-xs italic text-slate-600">
                                          (drop a section here)
                                        </li>
                                      )}
                                      {d.turnouts.length > 0 && (
                                        <li className="text-xs text-slate-500">
                                          Turnouts:{" "}
                                          {d.turnouts
                                            .map((t) => t.name)
                                            .join(" · ")}
                                        </li>
                                      )}
                                    </ul>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </>
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
