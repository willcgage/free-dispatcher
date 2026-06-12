"use client";

import { useMemo, useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { getOperator } from "@/lib/client/operator";
import { TrainCard } from "@/components/trains/TrainCard";
import type { TrainStatus } from "@/lib/db/schema";

const FILTERS: { label: string; value: "all" | TrainStatus }[] = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Holding", value: "holding" },
  { label: "Yard", value: "yard" },
];

export default function TrainsScreen() {
  const { state, refresh, connected } = useFdSession();
  const [filter, setFilter] = useState<"all" | TrainStatus>("all");
  const [mineOnly, setMineOnly] = useState(true);
  const op = getOperator();
  const isEngineer = op?.role === "engineer";

  const trains = useMemo(() => {
    let list = state?.trains ?? [];
    if (isEngineer && mineOnly && op) {
      list = list.filter((t) => t.assignedOperatorId === op.operatorId);
    }
    if (filter !== "all") {
      list = list.filter((t) => (t.currentStatus?.status ?? "yard") === filter);
    }
    return list;
  }, [state, filter, mineOnly, isEngineer, op]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Trains</h1>
        <span className={`text-xs ${connected ? "text-emerald-400" : "text-amber-400"}`}>
          {connected ? "● live" : "○ reconnecting"}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              filter === f.value
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        {isEngineer && (
          <button
            onClick={() => setMineOnly((m) => !m)}
            className={`ml-auto whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              mineOnly ? "bg-slate-800 text-slate-300" : "bg-sky-600 text-white"
            }`}
          >
            {mineOnly ? "My trains" : "All trains"}
          </button>
        )}
      </div>

      {trains.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No trains.</p>
      ) : (
        <div className="space-y-2">
          {trains.map((t) => (
            <TrainCard key={t.id} train={t} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
