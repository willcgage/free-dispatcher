"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import { moduleMatches } from "@/lib/client/moduleSearch";
import type { CatalogModule } from "@/lib/client/types";

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

export default function AdminModules() {
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiGet<{ modules: CatalogModule[] }>("/api/modules/catalog")
      .then((r) => setCatalog(r.modules))
      .catch(() => {});
    apiGet<SyncMeta>("/api/modules/sync").then(setSyncMeta).catch(() => {});
  }, []);

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
        const fresh = await apiGet<{ modules: CatalogModule[] }>(
          "/api/modules/catalog",
        );
        setCatalog(fresh.modules);
        setSyncMeta({
          last_synced_at: result.lastSyncedAt,
          module_count: fresh.modules.length,
        });
        setSyncMsg({ ok: true, text: `Synced ${result.synced} module(s)` });
      }
    } catch (err) {
      setSyncMsg({
        ok: false,
        text: err instanceof Error ? err.message : "sync failed",
      });
    } finally {
      setSyncBusy(false);
    }
  }

  const filtered = catalog.filter((m) => moduleMatches(m, query));

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Modules</h1>
      <p className="text-sm text-slate-400">
        The module catalog synced from the Module Repository. Assign modules to a
        layout over in{" "}
        <a href="/admin/layouts" className="text-sky-400 hover:underline">
          Layouts
        </a>
        .
      </p>

      <Panel title="Module Repository">
        <div className="flex flex-wrap items-center gap-3">
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
            <span
              className={`text-sm ${syncMsg.ok ? "text-emerald-400" : "text-red-400"}`}
            >
              {syncMsg.text}
            </span>
          )}
        </div>
        {syncMsg && !syncMsg.ok && syncMsg.text.includes("show_master") && (
          <p className="mt-2 text-xs text-slate-500">
            Go to Settings → Module Repository to sign in with an account that has
            show_master access.
          </p>
        )}
        {syncMsg && !syncMsg.ok && syncMsg.text.includes("sign in") && (
          <p className="mt-2 text-xs text-slate-500">
            Go to Settings → Module Repository to sign in first.
          </p>
        )}
      </Panel>

      <Panel title={`Catalog (${catalog.length})`}>
        {catalog.length === 0 ? (
          <p className="text-sm text-slate-400">
            No modules yet — sync the catalog above.
          </p>
        ) : (
          <>
            <input
              className="mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              placeholder="Search by record # or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="max-h-96 divide-y divide-slate-800 overflow-y-auto">
              {filtered.slice(0, 200).map((m) => (
                <li
                  key={m.recordNumber}
                  className="flex items-baseline gap-2 py-2 text-sm"
                >
                  <span className="shrink-0 font-mono text-slate-400">
                    {m.recordNumber}
                  </span>
                  <span className="truncate text-slate-200">{m.moduleName}</span>
                  {m.hasMss && (
                    <span className="shrink-0 rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs text-emerald-300">
                      MSS
                    </span>
                  )}
                  {m.owner && (
                    <span className="ml-auto shrink-0 text-xs text-slate-500">
                      {m.owner}
                    </span>
                  )}
                  {m.category && (
                    <span className={`${m.owner ? "" : "ml-auto"} shrink-0 text-xs text-slate-600`}>
                      {m.category}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
