"use client";

import { useZello } from "@/hooks/useZello";

/** Channel pill selector (spec §7.3). Switching reconnects on the free tier. */
export function ChannelBar() {
  const { availableChannels, activeChannel, switchChannel, configured } = useZello();
  if (availableChannels.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-3 py-1.5">
      {availableChannels.map((ch) => (
        <button
          key={ch}
          disabled={!configured}
          onClick={() => switchChannel(ch)}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
            ch === activeChannel
              ? "bg-sky-600 text-white"
              : "bg-slate-800 text-slate-300"
          } disabled:opacity-40`}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
