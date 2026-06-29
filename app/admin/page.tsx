"use client";

import { useCallback, useEffect, useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel, StatusBadge, Dot } from "@/components/admin/ui";

interface CommandStationStatus {
  type: string;
  label: string;
  connected: boolean;
  capabilities: { emergencyStop: boolean; emergencyOff: boolean };
  target: string | null;
}

type EmergencyMode = "stop" | "off" | "on";

function elapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function AdminDashboard() {
  const { state, opsLog, connected, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [cmd, setCmd] = useState<CommandStationStatus | null>(null);

  const session = state?.session ?? null;
  const trains = state?.trains ?? [];
  const operators = state?.operators ?? [];

  const loadCmd = useCallback(async () => {
    try {
      setCmd(await apiGet<CommandStationStatus>("/api/command-station"));
    } catch {
      /* status is best-effort */
    }
  }, []);

  useEffect(() => {
    // loadCmd setStates after an await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCmd();
  }, [loadCmd]);

  async function emergencyStop(mode: EmergencyMode) {
    const prompts: Record<EmergencyMode, string> = {
      stop: "Emergency Stop — revoke authority and halt trains?",
      off: "Emergency Off — revoke authority and CUT TRACK POWER?",
      on: "Restore track power?",
    };
    if (!confirm(prompts[mode])) return;
    setBusy(true);
    try {
      const res = await apiSend<{ physical?: { applied: boolean; detail?: string; reason?: string } }>(
        "POST",
        "/api/admin/emergency-stop",
        { mode },
      );
      const p = res.physical;
      if (p) {
        alert(
          p.applied
            ? `Done — ${p.detail}.`
            : `Authority ${mode === "on" ? "unchanged" : "revoked"}. No physical action: ${p.reason}.`,
        );
      }
      await Promise.all([refresh(), loadCmd()]);
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
            <div className="space-y-2">
              <button
                disabled={busy}
                onClick={() => emergencyStop("stop")}
                title={
                  cmd?.capabilities.emergencyStop
                    ? "Halt all trains, keep track power"
                    : "Revokes authority; this connection can't halt locos while keeping power"
                }
                className="w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                ⏹ Emergency Stop
              </button>
              <button
                disabled={busy}
                onClick={() => emergencyStop("off")}
                title={
                  cmd?.capabilities.emergencyOff
                    ? "Revoke authority and cut track power"
                    : "Revokes authority; no command station connected to cut power"
                }
                className="w-full rounded-md border border-red-700/60 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
              >
                ⚡ Emergency Off (cut power)
              </button>
              {cmd?.connected && cmd.capabilities.emergencyOff && (
                <button
                  disabled={busy}
                  onClick={() => emergencyStop("on")}
                  className="w-full rounded-md border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Restore power
                </button>
              )}
              <p className="pt-1 text-xs text-slate-500">
                {cmd ? (
                  <>
                    Command station:{" "}
                    <span className="text-slate-300">{cmd.label}</span>
                    {cmd.type !== "null" && (
                      <>
                        {" "}
                        ·{" "}
                        <span
                          className={
                            cmd.connected ? "text-emerald-400" : "text-amber-400"
                          }
                        >
                          {cmd.connected ? "connected" : "not connected"}
                        </span>
                        {cmd.target ? ` (${cmd.target})` : ""}
                      </>
                    )}
                  </>
                ) : (
                  "Checking command station…"
                )}
              </p>
            </div>
          </Panel>

          <Panel title={`Connected devices (${operators.length})`}>
            {operators.length === 0 ? (
              <p className="text-sm text-slate-400">No operators connected.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {operators.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span>{o.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs capitalize text-slate-300">
                      {o.role}
                    </span>
                  </li>
                ))}
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
