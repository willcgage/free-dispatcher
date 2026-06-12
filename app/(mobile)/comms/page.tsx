"use client";

import { useZello } from "@/hooks/useZello";

export default function CommsScreen() {
  const {
    availableChannels,
    activeChannel,
    switchChannel,
    isConnected,
    isTx,
    rxSpeaker,
    configured,
    startTx,
    stopTx,
  } = useZello();

  const status = !configured
    ? "PTT unavailable — token server not configured"
    : !isConnected
      ? "Reconnecting…"
      : isTx
        ? "Transmitting…"
        : rxSpeaker
          ? `🔊 ${rxSpeaker} speaking`
          : "Channel quiet";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Comms</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Channels</h2>
        <div className="flex flex-wrap gap-2">
          {availableChannels.map((ch) => (
            <button
              key={ch}
              disabled={!configured}
              onClick={() => switchChannel(ch)}
              className={`rounded-full px-3 py-1 text-sm ${
                ch === activeChannel
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-300"
              } disabled:opacity-40`}
            >
              {ch}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
        <div className={isTx ? "text-emerald-400" : "text-slate-400"}>{status}</div>
        <button
          disabled={!configured || !isConnected}
          onMouseDown={(e) => {
            e.preventDefault();
            startTx();
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            stopTx();
          }}
          onMouseLeave={(e) => {
            if (isTx) {
              e.preventDefault();
              stopTx();
            }
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            startTx();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopTx();
          }}
          className={`mt-4 w-full select-none rounded-2xl py-10 text-xl font-bold ${
            isTx
              ? "bg-emerald-500 text-white"
              : !configured || !isConnected
                ? "bg-slate-800 text-slate-500"
                : "bg-sky-600 text-white active:bg-sky-700"
          }`}
        >
          🎙 {isTx ? "Release to stop" : "Hold to transmit"}
        </button>
        {!configured && (
          <p className="mt-2 text-xs text-slate-600">
            Set up the Zello token server (token-server/) to enable voice.
          </p>
        )}
      </section>
    </div>
  );
}
