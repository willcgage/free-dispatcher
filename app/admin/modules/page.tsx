"use client";

import { useState, useEffect, useRef } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import type { StagingEnd } from "@/lib/db/schema";

interface CatalogModule {
  recordNumber: string;
  moduleName: string;
  category: string | null;
  geometryType: string | null;
  lengthFeet: number | null;
  lengthInches: number | null;
  endplateCount: number | null;
  hasMss: boolean | null;
}

interface SyncMeta {
  last_synced_at: string | null;
  module_count: number;
}

function formatSyncAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ModulePicker({
  catalog,
  value,
  onChange,
}: {
  catalog: CatalogModule[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? catalog.filter(
        (m) =>
          m.recordNumber.toLowerCase().includes(query.toLowerCase()) ||
          m.moduleName.toLowerCase().includes(query.toLowerCase()),
      )
    : catalog;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(m: CatalogModule) {
    onChange(m.recordNumber);
    setQuery(`${m.recordNumber} — ${m.moduleName}`);
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative flex-1">
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        placeholder={catalog.length > 0 ? "Search by record # or name…" : "No catalog — sync first"}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          {filtered.slice(0, 50).map((m) => (
            <li key={m.recordNumber}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800"
                onMouseDown={() => select(m)}
              >
                <span className="shrink-0 font-mono text-slate-400">{m.recordNumber}</span>
                <span className="truncate text-slate-200">{m.moduleName}</span>
                {m.category && (
                  <span className="ml-auto shrink-0 text-xs text-slate-500">{m.category}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminModules() {
  const { state, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [moduleId, setModuleId] = useState("");
  const [stagingEnd, setStagingEnd] = useState<"" | StagingEnd>("");
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const modules = state?.modules ?? [];

  useEffect(() => {
    apiGet<{ modules: CatalogModule[] }>("/api/modules/catalog")
      .then((r) => setCatalog(r.modules))
      .catch(() => {});
    apiGet<SyncMeta>("/api/modules/sync")
      .then(setSyncMeta)
      .catch(() => {});
  }, []);

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId.trim()) return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/modules", {
        moduleId: moduleId.trim(),
        stagingEnd: stagingEnd || undefined,
      });
      setModuleId("");
      setStagingEnd("");
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "add failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeModule(id: string) {
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/modules/${id}`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncCatalog() {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const result = await apiSend<
        { synced: number; lastSyncedAt: string } | { error: string; message: string }
      >("POST", "/api/modules/sync", undefined);

      if ("error" in result) {
        setSyncMsg({ ok: false, text: result.message });
      } else {
        setSyncMsg({ ok: true, text: `Synced ${result.synced} module(s)` });
        setSyncMeta({ last_synced_at: result.lastSyncedAt, module_count: catalog.length + result.synced });
        const fresh = await apiGet<{ modules: CatalogModule[] }>("/api/modules/catalog");
        setCatalog(fresh.modules);
        setSyncMeta({ last_synced_at: result.lastSyncedAt, module_count: fresh.modules.length });
      }
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : "sync failed" });
    } finally {
      setSyncBusy(false);
    }
  }

  if (!state?.session) {
    return <p className="text-slate-400">No active session.</p>;
  }

  const selectCls =
    "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Module layout</h1>
      <p className="text-sm text-slate-400">
        Linear track order for the session. Add modules in order from one staging
        end to the other.
      </p>

      <Panel title="Module catalog">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            disabled={syncBusy}
            onClick={syncCatalog}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {syncBusy ? "Syncing…" : "Sync catalog"}
          </button>
          <span className="text-sm text-slate-400">
            {syncMeta?.last_synced_at
              ? `${syncMeta.module_count} module(s) · last synced ${formatSyncAge(syncMeta.last_synced_at)}`
              : "Never synced"}
          </span>
          {syncMsg && (
            <span className={`text-sm ${syncMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
              {syncMsg.text}
            </span>
          )}
        </div>
        {syncMsg && !syncMsg.ok && syncMsg.text.includes("show_master") && (
          <p className="mt-2 text-xs text-slate-500">
            Go to Settings → Module Repository to sign in with an account that has show_master access.
          </p>
        )}
        {syncMsg && !syncMsg.ok && syncMsg.text.includes("sign in") && (
          <p className="mt-2 text-xs text-slate-500">
            Go to Settings → Module Repository to sign in first.
          </p>
        )}
      </Panel>

      <Panel title="Add module">
        <form onSubmit={addModule} className="flex flex-wrap items-end gap-3">
          <ModulePicker
            catalog={catalog}
            value={moduleId}
            onChange={setModuleId}
          />
          <select
            className={selectCls}
            value={stagingEnd}
            onChange={(e) => setStagingEnd(e.target.value as "" | StagingEnd)}
          >
            <option value="">— not staging —</option>
            <option value="A">Staging end A</option>
            <option value="B">Staging end B</option>
          </select>
          <button
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Append
          </button>
        </form>
      </Panel>

      <Panel title={`Track sequence (${modules.length})`}>
        {modules.length === 0 ? (
          <p className="text-sm text-slate-400">No modules placed yet.</p>
        ) : (
          <ol className="flex flex-wrap gap-2">
            {modules.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2"
              >
                <span className="text-xs text-slate-500">{i + 1}</span>
                <div>
                  <div className="font-mono text-sm">{m.moduleId}</div>
                  {m.moduleName && (
                    <div className="text-xs text-slate-400">{m.moduleName}</div>
                  )}
                </div>
                {m.stagingEnd && (
                  <span className="rounded bg-indigo-600/20 px-1.5 py-0.5 text-xs text-indigo-300">
                    staging {m.stagingEnd}
                  </span>
                )}
                <button
                  disabled={busy}
                  onClick={() => removeModule(m.id)}
                  className="ml-1 text-xs text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
