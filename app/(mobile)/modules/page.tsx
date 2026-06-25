"use client";

import { useFdSession } from "@/lib/client/useFdSession";

export default function ModulesScreen() {
  const { state } = useFdSession();
  const modules = state?.modules ?? [];
  const trains = state?.trains ?? [];

  const trainsAt = (moduleId: string) =>
    trains.filter((t) => t.currentStatus?.locationName === moduleId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Module layout</h1>
      <p className="text-sm text-slate-400">Linear track sequence for the session.</p>

      {modules.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No modules configured yet.
        </p>
      ) : (
        <div className="space-y-2">
          {modules.map((m, i) => {
            const here = trainsAt(m.moduleId);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <span className="text-xs text-slate-500">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm">
                    {m.moduleName ?? m.moduleId}
                  </div>
                  {m.moduleName && (
                    <div className="text-xs text-slate-500">{m.moduleId}</div>
                  )}
                  {here.length > 0 && (
                    <div className="mt-0.5 text-xs text-emerald-400">
                      {here.map((t) => `#${t.number}`).join(", ")} here
                    </div>
                  )}
                </div>
                {m.stagingEnd && (
                  <span className="shrink-0 rounded bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-300">
                    staging {m.stagingEnd}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
