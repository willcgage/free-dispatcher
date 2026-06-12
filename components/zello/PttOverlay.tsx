"use client";

import { useZello } from "@/hooks/useZello";

/**
 * Persistent push-to-talk bar (spec §7.5). Mounted once in the mobile shell so
 * it is visible on every operator screen. Hold to transmit; shows rx speaker /
 * reconnecting / unconfigured states. Touch handlers use preventDefault to
 * avoid the mobile double-fire.
 */
export function PttOverlay() {
  const { isConnected, isTx, rxSpeaker, configured, startTx, stopTx, activeChannel } =
    useZello();

  const down = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (configured && isConnected) startTx();
  };
  const up = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isTx) stopTx();
  };

  let label = "Hold to transmit";
  let disabled = false;
  if (!configured) {
    label = "PTT unavailable";
    disabled = true;
  } else if (!isConnected) {
    label = "Reconnecting…";
    disabled = true;
  } else if (isTx) {
    label = "Transmitting…";
  } else if (rxSpeaker) {
    label = `🔊 ${rxSpeaker}`;
  }

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur"
      style={{ bottom: "calc(var(--fd-nav-height) + var(--fd-safe-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <span className="w-20 shrink-0 text-[11px] text-slate-400">
          {activeChannel ?? "—"}
        </span>
        <button
          disabled={disabled}
          onMouseDown={down}
          onMouseUp={up}
          onMouseLeave={(e) => isTx && up(e)}
          onTouchStart={down}
          onTouchEnd={up}
          className={`flex-1 select-none rounded-xl py-3 text-center text-sm font-bold transition ${
            isTx
              ? "bg-emerald-500 text-white"
              : disabled
                ? "bg-slate-800 text-slate-500"
                : "bg-sky-600 text-white active:bg-sky-700"
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
