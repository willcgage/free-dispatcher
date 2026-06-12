"use client";

import { useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import type { StagingEnd } from "@/lib/db/schema";

export default function AdminModules() {
  const { state, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [moduleId, setModuleId] = useState("");
  const [stagingEnd, setStagingEnd] = useState<"" | StagingEnd>("");

  const modules = state?.modules ?? [];

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

  if (!state?.session) {
    return <p className="text-slate-400">No active session.</p>;
  }

  const input =
    "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Module layout</h1>
      <p className="text-sm text-slate-400">
        Linear track order for the session (Free-moN is a linear sequence, not a
        2D map). Add modules in order from one staging end to the other.
      </p>

      <Panel title="Add module">
        <form onSubmit={addModule} className="flex flex-wrap items-end gap-3">
          <input
            className={input}
            placeholder="Module record # (from repository)"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          />
          <select
            className={input}
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
                <span className="font-mono text-sm">{m.moduleId}</span>
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
