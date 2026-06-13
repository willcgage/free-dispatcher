"use client";

import { useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiSend } from "@/lib/client/api";
import { Panel, StatusBadge, Dot } from "@/components/admin/ui";

function elapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function AdminDashboard() {
  const { state, opsLog, connected, talking, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);

  const session = state?.session ?? null;
  const trains = state?.trains ?? [];
  const operators = state?.operators ?? [];

  async function emergencyStop() {
    if (!confirm("Emergency Stop All — revoke authority for every train?")) return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/admin/emergency-stop");
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "E-stop failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuthority(trainId: string, has: boolean) {
    setBusy(true);
    try {
      await apiSend(
        "POST",
        has ? "/api/authority/revoke" : "/api/authority/grant",
        { trainId },
      );
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "authority change failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
          No active session.{" "}
          <a href="/admin/session" className="text-sky-400 hover:underline">
            Create one →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Session status bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-3">
        <div>
          <div className="text-lg font-bold">{session.name}</div>
          <div className="text-xs text-slate-400">
            {session.venue ?? "—"} · {session.date ?? "—"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <div className="text-sm text-slate-300">
            <span className="text-slate-500">Elapsed </span>
            {elapsed(session.createdAt)}
          </div>
          <Dot on={connected} label={`${operators.length} operators`} />
          <Dot on={connected} label={connected ? "Live" : "Disconnected"} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Train board */}
        <Panel title="Train board" className="lg:col-span-2">
          {trains.length === 0 ? (
            <p className="text-sm text-slate-400">
              No trains yet.{" "}
              <a href="/admin/trains" className="text-sky-400 hover:underline">
                Add to roster →
              </a>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">DCC</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Location</th>
                  <th className="pb-2">Authority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {trains.map((t) => {
                  const has = t.currentStatus?.hasAuthority ?? false;
                  return (
                    <tr key={t.id}>
                      <td className="py-2 font-mono">{t.number}</td>
                      <td className="py-2">{t.name ?? "—"}</td>
                      <td className="py-2 font-mono text-slate-400">
                        {t.dccAddress ?? "—"}
                      </td>
                      <td className="py-2">
                        {t.currentStatus ? (
                          <StatusBadge status={t.currentStatus.status} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 text-slate-400">
                        {t.currentStatus?.locationName ?? "—"}
                      </td>
                      <td className="py-2">
                        <button
                          disabled={busy}
                          onClick={() => toggleAuthority(t.id, has)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            has
                              ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                              : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {has ? "🔒 Granted" : "Grant"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Quick actions + devices */}
        <div className="space-y-5">
          <Panel title="Quick actions">
            <button
              disabled={busy}
              onClick={emergencyStop}
              className="w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              ⏹ Emergency Stop All
            </button>
          </Panel>

          <Panel title={`Connected devices (${operators.length})`}>
            {operators.length === 0 ? (
              <p className="text-sm text-slate-400">No operators connected.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {operators.map((o) => {
                  const speaking = talking[o.id];
                  return (
                    <li key={o.id} className="flex items-center justify-between">
                      <span
                        className={speaking ? "font-medium text-green-300" : undefined}
                      >
                        {speaking ? "🔊 " : ""}
                        {o.name}
                        {speaking && (
                          <span className="ml-1 text-xs text-green-500">
                            on {speaking.channel}
                          </span>
                        )}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs capitalize text-slate-300">
                        {o.role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Ops log */}
      <Panel title="Operations log">
        {opsLog.length === 0 ? (
          <p className="text-sm text-slate-400">No events yet.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
            {opsLog.map((e) => (
              <li key={e.id} className="flex gap-3 text-slate-400">
                <span className="text-slate-600">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
                <span className="text-sky-400">{e.eventType}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
