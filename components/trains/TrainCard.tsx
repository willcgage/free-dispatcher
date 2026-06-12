"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import type { TrainRow } from "@/lib/client/types";
import type { TrainStatus } from "@/lib/db/schema";

const STATUS_STYLES: Record<TrainStatus, string> = {
  running: "bg-emerald-600/20 text-emerald-300",
  holding: "bg-amber-600/20 text-amber-300",
  yard: "bg-slate-600/30 text-slate-300",
  staging: "bg-indigo-600/20 text-indigo-300",
};

const ACTIONS: { label: string; status: TrainStatus }[] = [
  { label: "Running", status: "running" },
  { label: "Holding", status: "holding" },
  { label: "Arrived", status: "staging" },
];

export function TrainCard({
  train,
  expandable = true,
  onChanged,
}: {
  train: TrainRow;
  expandable?: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = train.currentStatus?.status ?? "yard";
  const hasAuthority = train.currentStatus?.hasAuthority ?? false;

  async function setStatus(next: TrainStatus) {
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/trains/${train.id}`, { status: next });
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50">
      <button
        onClick={() => expandable && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="font-mono text-lg font-bold">{train.number}</span>
        <span className="flex-1">
          <span className="block font-medium">{train.name ?? "—"}</span>
          <span className="block text-xs text-slate-500">
            DCC {train.dccAddress ?? "—"}
            {train.currentStatus?.locationName
              ? ` · ${train.currentStatus.locationName}`
              : ""}
          </span>
        </span>
        {hasAuthority && <span title="Holds authority">🔒</span>}
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
      </button>

      {expandable && open && (
        <div className="flex gap-2 border-t border-slate-800 px-4 py-3">
          {ACTIONS.map((a) => (
            <button
              key={a.status}
              disabled={busy || status === a.status}
              onClick={() => setStatus(a.status)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                status === a.status
                  ? "bg-slate-700 text-slate-400"
                  : "bg-slate-800 text-slate-100 active:bg-slate-700"
              } disabled:opacity-50`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
