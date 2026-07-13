"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import { moduleMatches } from "@/lib/client/moduleSearch";
import {
  DEFAULT_STANDARD,
  standardLabel,
  standardOptions,
} from "@/lib/client/standards";
import { MODULE_DRAG_MIME } from "@/components/layout/LayoutSchematic";
import { OperationsSchematic } from "@/components/layout/OperationsSchematic";
import { FootprintMap } from "@/components/layout/FootprintMap";
import { LayoutCanvas } from "@/components/layout/LayoutCanvas";
import {
  districtColor,
  districtLegend,
  moduleDistrictMap,
} from "@/lib/track/districts";
import {
  layoutControlPoints,
  deriveSections,
  asLayoutCps,
} from "@/lib/track/layoutControlPoints";
import {
  moduleUnavailability,
  UNAVAILABLE_LABEL,
  UNAVAILABLE_HINT,
} from "@/lib/track/moduleAvailability";
import type { CatalogModule } from "@/lib/client/types";
import type { StagingEnd } from "@/lib/db/schema";

// ---- API shapes (client-side mirror of the track model) ------------------
interface LayoutRow {
  id: string;
  name: string;
  description: string | null;
  standard: string;
  controlPointDistricts: Record<string, string> | null;
  layoutControlPoints: unknown;
  /** Placements whose module was removed/deactivated/archived upstream (#160). */
  atRiskModules: number;
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
  derivedKey: string | null;
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
  geometryOffsetInches: number | null;
  flipped: boolean;
  endplates: { label?: string | null; track_config?: string | null }[] | null;
  schematic: unknown;
  /** Set when the module was removed from the Module Repository (#155). */
  removedFromRepoAt: string | null;
  /** Owner's repo status: active | inactive | archived (#158). */
  status: string | null;
  /** Mirrored/flipped placement for the footprint solver (#175). */
  mirrored: boolean;
}
interface BranchSpine {
  id: string;
  name: string;
  origin: { placementId: string; endplateId: string };
  modules: LayoutModuleNode[];
}
interface EndplateRefNode {
  placementId: string;
  endplateId: string;
}
interface JoinNode {
  id: string;
  a: EndplateRefNode;
  b: EndplateRefNode;
  implicit?: boolean;
  status: "ok" | "mismatch" | "unknown" | "dangling";
}
interface LayoutTree extends LayoutRow {
  modules: LayoutModuleNode[];
  /** Branch spines (#170) — defs + their placements. */
  branchSpines: BranchSpine[];
  /** Endplate joins (#175) — implicit + explicit, with compatibility. */
  joins: JoinNode[];
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
  standard: string;
  districts: DistrictDraft[];
}

const EMPTY_DRAFT: LayoutDraft = {
  name: "",
  description: "",
  standard: DEFAULT_STANDARD,
  districts: [],
};

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
  // Add-form draft for a layout-level control point, keyed by layout id (#144).
  const [cpDraft, setCpDraft] = useState<
    Record<string, { name: string; anchor: string; offset: string }>
  >({});
  // Branch spines (#170): picker target + new-branch draft, keyed by layout id.
  const [addTarget, setAddTarget] = useState<Record<string, string>>({});
  const [branchDraft, setBranchDraft] = useState<
    Record<string, { name: string; placementId: string }>
  >({});
  // Explicit-join draft (#175), keyed by layout id: "<placementId>:<endplateId>".
  const [joinDraft, setJoinDraft] = useState<Record<string, { a: string; b: string }>>({});
  // Dropped-module notice + schematic highlight + replace flow (#158).
  const [unavailNotice, setUnavailNotice] = useState<{ layoutId: string } | null>(null);
  const unavailNotified = useRef<Set<string>>(new Set());
  const [highlightMods, setHighlightMods] = useState<Record<string, string[]>>({});
  const [replacing, setReplacing] = useState<{
    layoutId: string;
    placementId: string;
    value: string;
  } | null>(null);
  const [drag, setDrag] = useState<{ layoutId: string; from: number } | null>(
    null,
  );
  // Where a dragged catalog module would land in the sequence (drag-to-insert).
  const [insertAt, setInsertAt] = useState<{
    layoutId: string;
    index: number;
  } | null>(null);
  const [dragSection, setDragSection] = useState<{
    layoutId: string;
    sectionId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Layout ids whose map is in interactive "Arrange" mode (drag-to-connect). */
  const [arrange, setArrange] = useState<Record<string, boolean>>({});
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
    const opening = !expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!trees[id]) await reloadTree(id);
    // Opening a layout that contains dropped modules pops a notice (#158) —
    // once per layout per visit.
    if (opening && !unavailNotified.current.has(id)) {
      const tree =
        trees[id] ??
        (await apiGet<{ layout: LayoutTree }>(`/api/layouts/${id}`).then(
          (r) => r.layout,
          () => null,
        ));
      const dropped = (tree?.modules ?? []).filter((m) => moduleUnavailability(m));
      if (dropped.length > 0) {
        unavailNotified.current.add(id);
        setUnavailNotice({ layoutId: id });
      }
    }
  }

  /** Highlight a dropped module in the operations schematic and scroll to it. */
  function showInSchematic(layoutId: string, placementId: string) {
    setUnavailNotice(null);
    setHighlightMods((p) => ({ ...p, [layoutId]: [placementId] }));
    setTimeout(() => {
      document
        .getElementById(`ops-schematic-${layoutId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  /** Swap a placement to another catalog module, in place (#158). */
  async function replaceModule(layoutId: string, placementId: string, rec: string) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/modules/${placementId}`, { moduleId: rec });
      setReplacing(null);
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "replace failed");
    } finally {
      setBusy(false);
    }
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
      // Target spine (#170): the picker's "Add to" select — main or a branch.
      const branchId = addTarget[layoutId] || undefined;
      await apiSend("POST", "/api/modules", { layoutId, moduleIds: ids, branchId });
      setModChecked((p) => ({ ...p, [layoutId]: [] }));
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "add failed");
    } finally {
      setBusy(false);
    }
  }

  /** Replace the explicit endplate joins (#175). */
  async function saveJoins(
    layoutId: string,
    joins: { id: string; a: EndplateRefNode; b: EndplateRefNode }[],
  ) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/layouts/${layoutId}`, { joins });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  /** Toggle a placement's mirrored flag (#175). */
  async function toggleMirror(layoutId: string, placementId: string, mirrored: boolean) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/modules/${placementId}`, { mirrored: !mirrored });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(false);
    }
  }

  /** Create / delete branch spines (#170). */
  async function saveBranches(
    layoutId: string,
    branches: { id: string; name: string; origin: { placementId: string; endplateId: string } }[],
  ) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/layouts/${layoutId}`, { branches });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
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

  async function dropAddModule(layoutId: string, rec: string) {
    if (trees[layoutId]?.modules.some((m) => m.moduleId === rec)) return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/modules", { layoutId, moduleIds: [rec] });
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "add failed");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Insert a catalog module into a layout's sequence at `index` (drag-to-insert).
   * The add endpoint only appends, so add then reorder the new row into place.
   */
  async function insertModule(layoutId: string, rec: string, index: number) {
    const tree = trees[layoutId];
    if (!tree || tree.modules.some((m) => m.moduleId === rec)) return;
    setBusy(true);
    try {
      const { modules: created } = await apiSend<{ modules: { id: string }[] }>(
        "POST",
        "/api/modules",
        { layoutId, moduleIds: [rec] },
      );
      const newId = created?.[0]?.id;
      if (newId) {
        const ids = tree.modules.map((m) => m.id);
        ids.splice(Math.min(Math.max(index, 0), ids.length), 0, newId);
        await apiSend("POST", "/api/modules/reorder", {
          layoutId,
          orderedIds: ids,
        });
      }
      await Promise.all([reloadTree(layoutId), load()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "insert failed");
    } finally {
      setBusy(false);
    }
  }

  async function flipModule(layoutId: string, id: string, flipped: boolean) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/modules/${id}`, { flipped: !flipped });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "flip failed");
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

  /** Assign an imported control point to a district (#138). */
  async function assignControlPoint(
    layoutId: string,
    current: Record<string, string> | null,
    key: string,
    districtId: string,
  ) {
    const map = { ...(current ?? {}) };
    if (districtId) map[key] = districtId;
    else delete map[key];
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/layouts/${layoutId}`, {
        controlPointDistricts: map,
      });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "assign failed");
    } finally {
      setBusy(false);
    }
  }

  /** Add or remove a layout-level control point (#144). */
  async function saveLayoutControlPoints(
    layoutId: string,
    cps: { id: string; name: string; anchor: string; offsetInches: number }[],
  ) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/layouts/${layoutId}`, {
        layoutControlPoints: cps,
      });
      await reloadTree(layoutId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
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
      standard: d.standard || DEFAULT_STANDARD,
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
      {/* Dropped-modules notice (#158) */}
      {unavailNotice && trees[unavailNotice.layoutId] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setUnavailNotice(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-amber-800/60 bg-slate-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-amber-300">
              This layout uses modules no longer offered by the Module Repository
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              The layout keeps their data, but they were removed, deactivated,
              or archived upstream. Show one in the schematic, or replace it
              from the module list.
            </p>
            <ul className="space-y-1.5">
              {trees[unavailNotice.layoutId].modules
                .filter((m) => moduleUnavailability(m))
                .map((m) => {
                  const why = moduleUnavailability(m)!;
                  return (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-200">
                        {m.moduleName ?? m.moduleId}
                      </span>
                      <span className="rounded bg-amber-900/60 px-1 py-px text-[10px] uppercase text-amber-400">
                        {UNAVAILABLE_LABEL[why]}
                      </span>
                      <button
                        onClick={() =>
                          showInSchematic(unavailNotice.layoutId, m.id)
                        }
                        className="shrink-0 rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Show in schematic
                      </button>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-3 text-right">
              <button
                onClick={() => setUnavailNotice(null)}
                className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <span className="shrink-0 rounded bg-slate-700/50 px-1.5 py-0.5 text-xs font-medium text-slate-300">
                        {standardLabel(l.standard)}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                          in session
                        </span>
                      )}
                    </button>
                    {l.atRiskModules > 0 && (
                      <button
                        title="Modules in this layout were removed, deactivated, or archived in the Module Repository — click to review"
                        onClick={async () => {
                          if (!expanded.has(l.id)) {
                            setExpanded((p) => new Set(p).add(l.id));
                            if (!trees[l.id]) await reloadTree(l.id);
                          }
                          unavailNotified.current.add(l.id);
                          setUnavailNotice({ layoutId: l.id });
                        }}
                        className="shrink-0 rounded bg-amber-900/60 px-1.5 py-0.5 text-xs font-medium text-amber-300 hover:bg-amber-900"
                      >
                        ⚠ {l.atRiskModules} at-risk module{l.atRiskModules > 1 ? "s" : ""}
                      </button>
                    )}
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
                                    onDragOver={(e) => {
                                      if (
                                        e.dataTransfer.types.includes(
                                          MODULE_DRAG_MIME,
                                        )
                                      ) {
                                        // Insert the catalog module before this one.
                                        e.preventDefault();
                                        setInsertAt({ layoutId: l.id, index: i });
                                      } else if (drag?.layoutId === l.id) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onDrop={(e) => {
                                      const rec =
                                        e.dataTransfer.getData(MODULE_DRAG_MIME);
                                      if (rec) insertModule(l.id, rec, i);
                                      else if (drag && drag.layoutId === l.id)
                                        moveModule(
                                          l.id,
                                          tree.modules.map((x) => x.id),
                                          drag.from,
                                          i,
                                        );
                                      setDrag(null);
                                      setInsertAt(null);
                                    }}
                                    onDragEnd={() => {
                                      setDrag(null);
                                      setInsertAt(null);
                                    }}
                                    className={`flex items-center gap-2 rounded border bg-slate-800/60 px-2 py-1 ${
                                      insertAt?.layoutId === l.id &&
                                      insertAt.index === i
                                        ? "border-t-2 border-t-sky-400 border-slate-700"
                                        : "border-slate-700"
                                    } ${
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
                                      {(() => {
                                        const why = moduleUnavailability(m);
                                        return why ? (
                                          <span
                                            title={UNAVAILABLE_HINT[why]}
                                            className="ml-1.5 rounded bg-amber-900/60 px-1 py-px text-[10px] uppercase text-amber-400"
                                          >
                                            {UNAVAILABLE_LABEL[why]}
                                          </span>
                                        ) : null;
                                      })()}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs text-slate-500">
                                      {m.moduleId}
                                    </span>
                                    {replacing?.placementId === m.id ? (
                                      <span className="flex shrink-0 items-center gap-1">
                                        <select
                                          value={replacing.value}
                                          onChange={(e) =>
                                            setReplacing({ ...replacing, value: e.target.value })
                                          }
                                          className="max-w-44 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                        >
                                          <option value="">Replace with…</option>
                                          {catalog
                                            .filter((c) => c.recordNumber !== m.moduleId)
                                            .map((c) => (
                                              <option key={c.recordNumber} value={c.recordNumber}>
                                                {c.moduleName} · {c.recordNumber}
                                              </option>
                                            ))}
                                        </select>
                                        <button
                                          disabled={busy || !replacing.value}
                                          onClick={() =>
                                            replaceModule(l.id, m.id, replacing.value)
                                          }
                                          className="rounded bg-sky-700 px-1.5 py-0.5 text-xs text-white hover:bg-sky-600 disabled:opacity-40"
                                        >
                                          Swap
                                        </button>
                                        <button
                                          onClick={() => setReplacing(null)}
                                          className="rounded border border-slate-700 px-1 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        disabled={busy}
                                        title="Replace this placement with another catalog module (keeps its position)"
                                        onClick={() =>
                                          setReplacing({
                                            layoutId: l.id,
                                            placementId: m.id,
                                            value: "",
                                          })
                                        }
                                        className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
                                      >
                                        Replace
                                      </button>
                                    )}
                                    <button
                                      disabled={busy}
                                      title="Mirror this placement (flip it for the footprint — Free-mo modules are two-sided)"
                                      onClick={() => toggleMirror(l.id, m.id, m.mirrored)}
                                      className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${
                                        m.mirrored
                                          ? "border-sky-700 bg-sky-900/40 text-sky-300"
                                          : "border-slate-700 text-slate-400 hover:bg-slate-800"
                                      }`}
                                    >
                                      ⇋
                                    </button>
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
                                      onClick={() =>
                                        flipModule(l.id, m.id, m.flipped)
                                      }
                                      title={
                                        m.flipped
                                          ? "Reversed (turned end-for-end) — click to restore"
                                          : "Reverse — turn the module end-for-end (swap which endplate faces each neighbour)"
                                      }
                                      className={`shrink-0 rounded border px-1 py-0.5 text-xs ${
                                        m.flipped
                                          ? "border-amber-600/60 bg-amber-600/20 text-amber-300"
                                          : "border-slate-700 text-slate-400 hover:bg-slate-800"
                                      }`}
                                    >
                                      ⟲
                                    </button>
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
                                {/* Append zone — drop past the last module. */}
                                <li
                                  onDragOver={(e) => {
                                    if (
                                      e.dataTransfer.types.includes(
                                        MODULE_DRAG_MIME,
                                      )
                                    ) {
                                      e.preventDefault();
                                      setInsertAt({
                                        layoutId: l.id,
                                        index: tree.modules.length,
                                      });
                                    }
                                  }}
                                  onDrop={(e) => {
                                    const rec =
                                      e.dataTransfer.getData(MODULE_DRAG_MIME);
                                    if (rec)
                                      insertModule(
                                        l.id,
                                        rec,
                                        tree.modules.length,
                                      );
                                    setInsertAt(null);
                                  }}
                                  className={`rounded border border-dashed px-2 py-1 text-center text-[10px] ${
                                    insertAt?.layoutId === l.id &&
                                    insertAt.index === tree.modules.length
                                      ? "border-sky-400 text-sky-300"
                                      : "border-slate-800 text-slate-600"
                                  }`}
                                >
                                  drop here to add at end
                                </li>
                              </ul>
                            ) : (
                              <p className="mb-2 text-xs text-slate-600">
                                No modules assigned yet.
                              </p>
                            )}

                            {/* Branch spines (#170) */}
                            {tree.branchSpines.map((b) => (
                              <div key={b.id} className="mb-2 rounded border border-slate-800 bg-slate-900/40 p-1.5">
                                <div className="mb-1 flex items-center gap-2 text-xs">
                                  <span className="text-slate-400">⤷</span>
                                  <span className="font-medium text-slate-200">{b.name}</span>
                                  <span className="text-slate-500">
                                    from{" "}
                                    {tree.modules.find((m) => m.id === b.origin.placementId)
                                      ?.moduleName ?? "?"}{" "}
                                    ({b.origin.endplateId})
                                  </span>
                                  <button
                                    disabled={busy}
                                    title="Delete branch — its modules return to the main line"
                                    onClick={() =>
                                      saveBranches(
                                        l.id,
                                        tree.branchSpines
                                          .filter((x) => x.id !== b.id)
                                          .map(({ id, name, origin }) => ({ id, name, origin })),
                                      )
                                    }
                                    className="ml-auto rounded px-1 text-xs text-slate-500 hover:text-red-400"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {b.modules.length === 0 ? (
                                  <p className="text-[11px] text-slate-600">
                                    No modules — pick “→ {b.name}” in the catalog’s Add-to select.
                                  </p>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {b.modules.map((m, bi) => (
                                      <li key={m.id} className="flex items-center gap-2 text-sm">
                                        <span className="w-5 shrink-0 text-right text-xs text-slate-500">
                                          {bi + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-slate-200">
                                          {m.moduleName ?? m.moduleId}
                                        </span>
                                        <span className="shrink-0 font-mono text-xs text-slate-500">
                                          {m.moduleId}
                                        </span>
                                        <button
                                          disabled={busy}
                                          onClick={() => removeModule(l.id, m.id)}
                                          className="shrink-0 rounded px-1 text-xs text-slate-500 hover:text-red-400"
                                        >
                                          ✕
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                            {/* New branch: anchored at a main-spine module */}
                            {tree.modules.length > 0 && (
                              <div className="mb-2 flex items-center gap-1.5">
                                <input
                                  value={branchDraft[l.id]?.name ?? ""}
                                  placeholder="New branch (e.g. Bowl Idaho)"
                                  onChange={(e) =>
                                    setBranchDraft((p) => ({
                                      ...p,
                                      [l.id]: {
                                        name: e.target.value,
                                        placementId:
                                          p[l.id]?.placementId ?? tree.modules[0].id,
                                      },
                                    }))
                                  }
                                  className="w-44 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200"
                                />
                                <span className="text-xs text-slate-500">from</span>
                                <select
                                  value={branchDraft[l.id]?.placementId ?? tree.modules[0].id}
                                  onChange={(e) =>
                                    setBranchDraft((p) => ({
                                      ...p,
                                      [l.id]: {
                                        name: p[l.id]?.name ?? "",
                                        placementId: e.target.value,
                                      },
                                    }))
                                  }
                                  className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                >
                                  {tree.modules.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.moduleName ?? m.moduleId}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  disabled={busy || !(branchDraft[l.id]?.name ?? "").trim()}
                                  onClick={() => {
                                    const d = branchDraft[l.id]!;
                                    setBranchDraft((p) => ({
                                      ...p,
                                      [l.id]: { name: "", placementId: d.placementId },
                                    }));
                                    saveBranches(l.id, [
                                      ...tree.branchSpines.map(({ id, name, origin }) => ({ id, name, origin })),
                                      {
                                        id: `br-${Date.now().toString(36)}`,
                                        name: d.name.trim(),
                                        origin: { placementId: d.placementId, endplateId: "C" },
                                      },
                                    ]);
                                  }}
                                  className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                                >
                                  + Branch
                                </button>
                              </div>
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
                                  {tree.branchSpines.length > 0 && (
                                    <select
                                      value={addTarget[l.id] ?? ""}
                                      onChange={(e) =>
                                        setAddTarget((p) => ({ ...p, [l.id]: e.target.value }))
                                      }
                                      title="Which spine new modules join (#170)"
                                      className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1 py-1 text-xs text-slate-300"
                                    >
                                      <option value="">→ Main line</option>
                                      {tree.branchSpines.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          → {b.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    disabled={busy || checkedOf(l.id).length === 0}
                                    onClick={() => addModules(l.id)}
                                    className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                                  >
                                    Add {checkedOf(l.id).length || ""}
                                  </button>
                                </div>
                                <p className="mb-1 text-[11px] text-slate-500">
                                  Showing{" "}
                                  <span className="text-slate-300">
                                    {standardLabel(l.standard)}
                                  </span>{" "}
                                  modules.
                                </p>
                                <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                                  {catalog
                                    .filter(
                                      (m) =>
                                        // The layout's standard (null = legacy,
                                        // pre-backfill; shown until re-synced #123).
                                        (m.standard === l.standard ||
                                          m.standard == null) &&
                                        moduleMatches(m, qOf(l.id)),
                                    )
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
                                            draggable={!isAssigned && !busy}
                                            onDragStart={(e) => {
                                              if (isAssigned) return;
                                              e.dataTransfer.setData(
                                                MODULE_DRAG_MIME,
                                                m.recordNumber,
                                              );
                                              e.dataTransfer.effectAllowed = "copy";
                                            }}
                                            title={
                                              isAssigned
                                                ? undefined
                                                : "Check to batch-add, or drag onto the schematic"
                                            }
                                            className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${
                                              isAssigned
                                                ? "opacity-50"
                                                : "cursor-grab hover:bg-slate-800/60"
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

                          {/* Operations schematic (straightened — primary).
                              Branch spines stack as their own bands below the
                              main line, the CATS/US&S multi-band idiom (#170). */}
                          <div id={`ops-schematic-${l.id}`}>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Operations schematic
                            </div>
                            <OperationsSchematic
                              modules={tree.modules}
                              districts={tree.districts}
                              highlightModuleIds={highlightMods[l.id]}
                            />
                            {tree.branchSpines
                              .filter((b) => b.modules.length > 0)
                              .map((b) => (
                                <div key={b.id} className="mt-2">
                                  <div className="mb-0.5 text-[11px] text-slate-500">
                                    ⤷ <span className="text-slate-300">{b.name}</span>{" "}
                                    — from{" "}
                                    {tree.modules.find(
                                      (m) => m.id === b.origin.placementId,
                                    )?.moduleName ?? "the main line"}{" "}
                                    ({b.origin.endplateId})
                                  </div>
                                  <OperationsSchematic
                                    modules={b.modules}
                                    districts={tree.districts}
                                    highlightModuleIds={highlightMods[l.id]}
                                  branchBand
                                  />
                                </div>
                              ))}
                          </div>

                          {/* Layout map — one view: solved geometry + district
                              colours + labels + endplate mismatches (#175). */}
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Layout map
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setArrange((s) => ({ ...s, [l.id]: !s[l.id] }))
                                }
                                title="Drag modules to connect their endplates (beta)"
                                className={`rounded border px-2 py-0.5 text-[11px] ${
                                  arrange[l.id]
                                    ? "border-sky-600 bg-sky-900/40 text-sky-300"
                                    : "border-slate-700 text-slate-400 hover:bg-slate-800"
                                }`}
                              >
                                {arrange[l.id] ? "Done arranging" : "Arrange ⤢"}
                              </button>
                            </div>
                            {(() => {
                              const dmap = moduleDistrictMap(tree.districts);
                              const modById = new Map(
                                [
                                  ...tree.modules,
                                  ...tree.branchSpines.flatMap((b) => b.modules),
                                ].map((m) => [m.id, m]),
                              );
                              const colorFor = (pid: string) => {
                                const mid = modById.get(pid)?.moduleId;
                                const d = mid ? dmap.get(mid) : undefined;
                                return d ? districtColor(d.index) : undefined;
                              };
                              const fpModules = [...modById.values()].map((m) => ({
                                id: m.id,
                                moduleName: m.moduleName,
                                moduleId: m.moduleId,
                                lengthTotalInches: m.lengthTotalInches,
                                mainlineLengthInches: m.mainlineLengthInches,
                                geometryType: m.geometryType,
                                geometryDegrees: m.geometryDegrees,
                                geometryOffsetInches: m.geometryOffsetInches,
                                mirrored: m.mirrored,
                                schematic: m.schematic,
                              }));
                              return arrange[l.id] ? (
                                <LayoutCanvas
                                  modules={fpModules}
                                  joins={tree.joins}
                                  colorFor={colorFor}
                                  onAddJoin={(j) => {
                                    const explicit = tree.joins
                                      .filter((x) => !x.implicit)
                                      .map((x) => ({ id: x.id, a: x.a, b: x.b }));
                                    saveJoins(l.id, [...explicit, { id: j.id, a: j.a, b: j.b }]);
                                  }}
                                />
                              ) : (
                                <FootprintMap
                                  modules={fpModules}
                                  joins={tree.joins}
                                  colorFor={colorFor}
                                  legend={districtLegend(tree.districts)}
                                  onDropModule={(rec) => dropAddModule(l.id, rec)}
                                />
                              );
                            })()}
                          </div>

                          {/* Endplate joins (#175) */}
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Endplate joins
                            </div>
                            {(() => {
                              const allMods = [
                                ...tree.modules,
                                ...tree.branchSpines.flatMap((b) => b.modules),
                              ];
                              const modById = new Map(allMods.map((m) => [m.id, m]));
                              const epsOf = (m?: LayoutModuleNode): string[] => {
                                const doc = m?.schematic as
                                  | { endplates?: { id?: string }[] }
                                  | null
                                  | undefined;
                                const ids = (doc?.endplates ?? [])
                                  .map((e) => e?.id)
                                  .filter((x): x is string => !!x);
                                return ids.length ? ids : ["A", "B"];
                              };
                              const label = (r: EndplateRefNode) => {
                                const m = modById.get(r.placementId);
                                return `${m?.moduleName ?? m?.moduleId ?? "?"} · ${r.endplateId}`;
                              };
                              const statusColor: Record<string, string> = {
                                ok: "text-emerald-400",
                                mismatch: "text-amber-400",
                                unknown: "text-slate-500",
                                dangling: "text-red-400",
                              };
                              const draft = joinDraft[l.id] ?? { a: "", b: "" };
                              const epOptions = allMods.flatMap((m) =>
                                epsOf(m).map((ep) => ({
                                  value: `${m.id}:${ep}`,
                                  text: `${m.moduleName ?? m.moduleId} · ${ep}`,
                                })),
                              );
                              if (allMods.length === 0)
                                return (
                                  <p className="text-xs text-slate-600">
                                    Add modules to see how their endplates connect.
                                  </p>
                                );
                              return (
                                <>
                                  <ul className="space-y-0.5">
                                    {tree.joins.map((j) => (
                                      <li key={j.id} className="flex items-center gap-2 text-xs">
                                        <span className={statusColor[j.status]} title={j.status}>
                                          {j.status === "ok"
                                            ? "●"
                                            : j.status === "mismatch"
                                              ? "▲"
                                              : j.status === "dangling"
                                                ? "✕"
                                                : "○"}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-slate-300">
                                          {label(j.a)} ↔ {label(j.b)}
                                        </span>
                                        {j.implicit ? (
                                          <span className="shrink-0 rounded bg-slate-800 px-1 py-px text-[10px] uppercase text-slate-500">
                                            spine
                                          </span>
                                        ) : (
                                          <button
                                            disabled={busy}
                                            title="Remove this join"
                                            onClick={() =>
                                              saveJoins(
                                                l.id,
                                                tree.joins
                                                  .filter((x) => !x.implicit && x.id !== j.id)
                                                  .map(({ id, a, b }) => ({ id, a, b })),
                                              )
                                            }
                                            className="shrink-0 rounded px-1 text-slate-500 hover:text-red-400"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                  {/* Add an explicit join — close a circuit, connect any two endplates */}
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <select
                                      value={draft.a}
                                      onChange={(e) =>
                                        setJoinDraft((p) => ({ ...p, [l.id]: { ...draft, a: e.target.value } }))
                                      }
                                      className="max-w-40 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                    >
                                      <option value="">endplate…</option>
                                      {epOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.text}</option>
                                      ))}
                                    </select>
                                    <span className="text-xs text-slate-500">↔</span>
                                    <select
                                      value={draft.b}
                                      onChange={(e) =>
                                        setJoinDraft((p) => ({ ...p, [l.id]: { ...draft, b: e.target.value } }))
                                      }
                                      className="max-w-40 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                    >
                                      <option value="">endplate…</option>
                                      {epOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.text}</option>
                                      ))}
                                    </select>
                                    <button
                                      disabled={busy || !draft.a || !draft.b || draft.a === draft.b}
                                      onClick={() => {
                                        const [pa, ea] = draft.a.split(":");
                                        const [pb, eb] = draft.b.split(":");
                                        setJoinDraft((p) => ({ ...p, [l.id]: { a: "", b: "" } }));
                                        saveJoins(l.id, [
                                          ...tree.joins
                                            .filter((x) => !x.implicit)
                                            .map(({ id, a, b }) => ({ id, a, b })),
                                          {
                                            id: `join-${Date.now().toString(36)}`,
                                            a: { placementId: pa, endplateId: ea },
                                            b: { placementId: pb, endplateId: eb },
                                          },
                                        ]);
                                      }}
                                      className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                                    >
                                      + Join
                                    </button>
                                    <span className="text-[11px] text-slate-600">
                                      spine joins are automatic — add one to close a loop or link any two ends
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Control Points → Districts (#138) */}
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Control Points → Districts
                            </div>
                            {(() => {
                              const layoutCps = asLayoutCps(tree.layoutControlPoints);
                              // Main spine first, then each branch (#170) —
                              // sections never derive across the junction.
                              const cps = [
                                ...layoutControlPoints(tree.modules, layoutCps),
                                ...tree.branchSpines.flatMap((b) =>
                                  layoutControlPoints(b.modules, layoutCps, b.id),
                                ),
                              ];
                              const draft = cpDraft[l.id] ?? {
                                name: "",
                                anchor: tree.modules[0]?.id ?? "",
                                offset: "",
                              };
                              const addForm = tree.modules.length > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <input
                                    value={draft.name}
                                    placeholder="New control point"
                                    onChange={(e) =>
                                      setCpDraft((p) => ({
                                        ...p,
                                        [l.id]: { ...draft, name: e.target.value },
                                      }))
                                    }
                                    className="w-36 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200"
                                  />
                                  <select
                                    value={draft.anchor}
                                    onChange={(e) =>
                                      setCpDraft((p) => ({
                                        ...p,
                                        [l.id]: { ...draft, anchor: e.target.value },
                                      }))
                                    }
                                    className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                  >
                                    {tree.modules.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.moduleName ?? m.moduleId}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={draft.offset}
                                    placeholder="in from A"
                                    inputMode="decimal"
                                    onChange={(e) =>
                                      setCpDraft((p) => ({
                                        ...p,
                                        [l.id]: { ...draft, offset: e.target.value },
                                      }))
                                    }
                                    className="w-20 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200"
                                  />
                                  <button
                                    disabled={
                                      busy ||
                                      !draft.name.trim() ||
                                      !draft.anchor ||
                                      !Number.isFinite(Number(draft.offset)) ||
                                      draft.offset.trim() === ""
                                    }
                                    onClick={() => {
                                      const cp = {
                                        id: `lcp-${Date.now().toString(36)}`,
                                        name: draft.name.trim(),
                                        anchor: draft.anchor,
                                        offsetInches: Number(draft.offset),
                                      };
                                      setCpDraft((p) => ({
                                        ...p,
                                        [l.id]: { ...draft, name: "", offset: "" },
                                      }));
                                      saveLayoutControlPoints(l.id, [...layoutCps, cp]);
                                    }}
                                    className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                                  >
                                    + Add
                                  </button>
                                </div>
                              );
                              if (cps.length === 0)
                                return (
                                  <>
                                    <p className="text-xs text-slate-600">
                                      No control points yet — author them in the
                                      modules&rsquo; schematics (Module Repository),
                                      or add one at the layout level below.
                                    </p>
                                    {addForm}
                                  </>
                                );
                              const assign = tree.controlPointDistricts ?? {};
                              const sections = deriveSections(cps, assign);
                              return (
                                <>
                                  <ul className="space-y-1">
                                    {cps.map((cp) => (
                                      <li key={cp.key} className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-slate-200">
                                          {cp.name}
                                          {cp.source === "layout" && (
                                            <span className="ml-1.5 rounded bg-slate-700 px-1 py-px text-[10px] uppercase text-slate-400">
                                              layout
                                            </span>
                                          )}
                                        </span>
                                        <span className="shrink-0 font-mono text-xs text-slate-500">
                                          {cp.moduleId}
                                          {cp.source === "layout" &&
                                            ` @ ${cp.posInches ?? 0}"`}
                                        </span>
                                        {tree.districts.length > 0 && (
                                          <select
                                            value={assign[cp.key] ?? assign[cp.legacyKey] ?? ""}
                                            disabled={busy}
                                            onChange={(e) =>
                                              assignControlPoint(
                                                l.id,
                                                tree.controlPointDistricts,
                                                cp.key,
                                                e.target.value,
                                              )
                                            }
                                            className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-300"
                                          >
                                            <option value="">— district</option>
                                            {tree.districts.map((d) => (
                                              <option key={d.id} value={d.id}>
                                                {d.name}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                        {cp.source === "layout" && (
                                          <button
                                            disabled={busy}
                                            title="Remove layout control point"
                                            onClick={() =>
                                              saveLayoutControlPoints(
                                                l.id,
                                                layoutCps.filter(
                                                  (x) => x.id !== cp.cpId,
                                                ),
                                              )
                                            }
                                            className="shrink-0 rounded px-1 text-xs text-slate-500 hover:text-red-400"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                  {tree.districts.length === 0 && (
                                    <p className="mt-1 text-xs text-slate-600">
                                      Add districts (below) to assign control points.
                                    </p>
                                  )}
                                  {addForm}
                                  {sections.length > 0 && (
                                    <p className="mt-2 text-xs text-slate-400">
                                      <span className="font-semibold text-slate-300">
                                        Sections
                                      </span>{" "}
                                      (derived between adjacent control points):{" "}
                                      {sections.map((s, i) => {
                                        const d = tree.districts.find(
                                          (x) => x.id === s.districtId,
                                        );
                                        return (
                                          <span key={`${s.fromKey}-${s.toKey}`}>
                                            {i > 0 && " · "}
                                            {s.name}
                                            {d ? ` (${d.name})` : ""}
                                          </span>
                                        );
                                      })}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
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
                                          draggable={!busy && !s.derivedKey}
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            if (s.derivedKey) return;
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
                                          <span
                                            className={`select-none text-slate-600 ${
                                              s.derivedKey
                                                ? "invisible"
                                                : "cursor-grab"
                                            }`}
                                          >
                                            ⠿
                                          </span>
                                          <span className="text-slate-300">
                                            {s.name}
                                          </span>
                                          {s.derivedKey && (
                                            <span
                                              title="Materialized from control points — its district follows the assignment"
                                              className="rounded bg-slate-700 px-1 py-px text-[10px] uppercase text-slate-400"
                                            >
                                              derived
                                            </span>
                                          )}
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

          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span className="shrink-0">Standard</span>
            <select
              className={`${input} max-w-[12rem]`}
              value={draft.standard}
              onChange={(e) => mutate((d) => (d.standard = e.target.value))}
              title="The modular standard this layout is built to; its module catalog is filtered to this."
            >
              {standardOptions(catalog).map((s) => (
                <option key={s} value={s}>
                  {standardLabel(s)}
                </option>
              ))}
            </select>
          </label>

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
