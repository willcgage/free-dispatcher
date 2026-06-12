"use client";

import type { TrainStatus } from "@/lib/db/schema";

export function Panel({
  title,
  children,
  className = "",
  actions,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-800 bg-slate-900/40 ${className}`}
    >
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const STATUS_STYLES: Record<TrainStatus, string> = {
  running: "bg-emerald-600/20 text-emerald-300 border-emerald-700/50",
  holding: "bg-amber-600/20 text-amber-300 border-amber-700/50",
  yard: "bg-slate-600/30 text-slate-300 border-slate-600/50",
  staging: "bg-indigo-600/20 text-indigo-300 border-indigo-700/50",
};

export function StatusBadge({ status }: { status: TrainStatus }) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-slate-600"}`}
      />
      {label}
    </span>
  );
}
