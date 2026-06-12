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
    canTalk,
    startTx,
    stopTx,
  } = useZello();

  const status = !configured
    ? "Voice unavailable — no Zello token configured"
    : !isConnected
      ? "Connecting…"
      : isTx
        ? "Transmitting…"
        : rxSpeaker
          ? `🔊 ${rxSpeaker} speaking`
          : canTalk
            ? "Channel quiet"
            : "Listen-only — hearing this channel";

  const canPtt = configured && isConnected && canTalk;

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
          disabled={!canPtt}
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
              : !canPtt
                ? "bg-slate-800 text-slate-500"
                : "bg-sky-600 text-white active:bg-sky-700"
          }`}
        >
          🎙 {isTx ? "Release to stop" : canTalk ? "Hold to transmit" : "Listen-only"}
        </button>

        {configured && !canTalk && (
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            <p>
              You’re hearing the channel. To talk, either add your Zello login in{" "}
              <a href="/settings" className="text-sky-400 hover:underline">
                Settings
              </a>{" "}
              or use the standalone Zello app.
            </p>
            {activeChannel && (
              <a
                href={`zello://${encodeURIComponent(activeChannel)}`}
                className="inline-block rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200"
              >
                Open in Zello app →
              </a>
            )}
          </div>
        )}
        {!configured && (
          <p className="mt-2 text-xs text-slate-600">
            Admin: paste a Zello 30-day dev token in Settings to enable voice.
          </p>
        )}
      </section>
    </div>
  );
}
