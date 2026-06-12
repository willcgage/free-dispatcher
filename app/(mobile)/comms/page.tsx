"use client";

import { getOperator, CHANNEL_DEFAULTS } from "@/lib/client/operator";
import { useFdSession } from "@/lib/client/useFdSession";

export default function CommsScreen() {
  const op = getOperator();
  const { speaking } = useFdSession();
  const channels = op ? CHANNEL_DEFAULTS[op.role] : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Comms</h1>

      {channels && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Channels</h2>
          <div className="flex flex-wrap gap-2">
            {channels.available.map((ch) => (
              <span
                key={ch}
                className={`rounded-full px-3 py-1 text-sm ${
                  ch === channels.default
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Default for {op?.role}: {channels.default}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
        {speaking ? (
          <div className="text-emerald-400">
            🔊 {speaking.operatorName} speaking on {speaking.channel}
          </div>
        ) : (
          <div className="text-slate-500">Channel quiet</div>
        )}
        <button
          disabled
          className="mt-4 w-full rounded-xl bg-slate-800 py-6 text-lg font-bold text-slate-500"
        >
          🎙 Hold to transmit
        </button>
        <p className="mt-2 text-xs text-slate-600">
          Zello PTT voice arrives in Phase 5.
        </p>
      </section>
    </div>
  );
}
