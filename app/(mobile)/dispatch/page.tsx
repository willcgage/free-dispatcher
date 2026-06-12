"use client";

import { useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiSend } from "@/lib/client/api";
import type { TrainRow } from "@/lib/client/types";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function DispatchScreen() {
  const { state, opsLog, refresh, connected } = useFdSession();
  const [busy, setBusy] = useState(false);
  const trains = state?.trains ?? [];

  const counts = {
    running: trains.filter((t) => t.currentStatus?.status === "running").length,
    holding: trains.filter((t) => t.currentStatus?.status === "holding").length,
    yard: trains.filter((t) => t.currentStatus?.status === "yard").length,
  };

  async function toggleAuthority(t: TrainRow) {
    const has = t.currentStatus?.hasAuthority ?? false;
    setBusy(true);
    try {
      await apiSend("POST", has ? "/api/authority/revoke" : "/api/authority/grant", {
        trainId: t.id,
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dispatch</h1>
        <span className={`text-xs ${connected ? "text-emerald-400" : "text-amber-400"}`}>
          {connected ? "● live" : "○ reconnecting"}
        </span>
      </div>

      <div className="flex gap-2">
        <Metric label="Running" value={counts.running} />
        <Metric label="Holding" value={counts.holding} />
        <Metric label="In yard" value={counts.yard} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Authority</h2>
        <div className="space-y-2">
          {trains.length === 0 && (
            <p className="text-sm text-slate-500">No trains in session.</p>
          )}
          {trains.map((t) => {
            const has = t.currentStatus?.hasAuthority ?? false;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <span className="font-mono font-bold">{t.number}</span>
                <span className="flex-1 text-sm">{t.name ?? "—"}</span>
                <button
                  disabled={busy}
                  onClick={() => toggleAuthority(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    has
                      ? "bg-emerald-600/20 text-emerald-300"
                      : "bg-slate-800 text-slate-200 active:bg-slate-700"
                  }`}
                >
                  {has ? "🔒 Granted" : "Grant"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Recent activity</h2>
        <ul className="space-y-1 font-mono text-xs text-slate-400">
          {opsLog.slice(0, 10).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="text-slate-600">
                {new Date(e.createdAt).toLocaleTimeString()}
              </span>
              <span className="text-sky-400">{e.eventType}</span>
            </li>
          ))}
          {opsLog.length === 0 && <li className="text-slate-600">No events yet.</li>}
        </ul>
      </section>
    </div>
  );
}
