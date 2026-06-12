"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiGet } from "@/lib/client/api";
import { getOperator, clearOperator, CHANNEL_DEFAULTS } from "@/lib/client/operator";

interface WiThrottleStatus {
  enabled: boolean;
  state: "disconnected" | "connecting" | "connected";
  acquired: { address: number; name: string; trainNumber: string | null }[];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { state, connected } = useFdSession();
  const op = getOperator();
  const channels = op ? CHANNEL_DEFAULTS[op.role] : null;
  const showWiThrottle = op?.role === "engineer" || op?.role === "yardmaster";

  const [wt, setWt] = useState<WiThrottleStatus | null>(null);
  useEffect(() => {
    if (!showWiThrottle) return;
    let alive = true;
    const poll = () =>
      apiGet<WiThrottleStatus>("/api/withrottle")
        .then((s) => alive && setWt(s))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [showWiThrottle]);

  const wtLabel = !wt?.enabled
    ? "Off"
    : wt.state === "connected"
      ? "Connected"
      : wt.state === "connecting"
        ? "Connecting…"
        : "Disconnected";
  const myLoco = wt?.acquired[0];

  function leave() {
    if (!confirm("Leave the session on this device?")) return;
    clearOperator();
    router.replace("/join");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 px-4">
        <Row label="Operator" value={op?.name ?? "—"} />
        <Row
          label="Role"
          value={<span className="capitalize text-sky-400">{op?.role ?? "—"}</span>}
        />
        <Row label="Session" value={state?.session?.name ?? "—"} />
        <Row
          label="Server"
          value={
            <span className={connected ? "text-emerald-400" : "text-amber-400"}>
              {connected ? "Connected" : "Reconnecting…"}
            </span>
          }
        />
        <Row label="Zello channel" value={channels?.default ?? "—"} />
        {showWiThrottle && (
          <Row
            label="WiThrottle"
            value={
              <span
                className={
                  wt?.state === "connected"
                    ? "text-emerald-400"
                    : wt?.enabled
                      ? "text-amber-400"
                      : "text-slate-500"
                }
              >
                {wtLabel}
              </span>
            }
          />
        )}
        {showWiThrottle && (
          <Row
            label="Loco acquired"
            value={
              myLoco ? (
                <span>
                  {myLoco.address}
                  {myLoco.trainNumber ? ` · #${myLoco.trainNumber}` : ""}
                </span>
              ) : (
                <span className="text-slate-500">none</span>
              )
            }
          />
        )}
      </section>

      {showWiThrottle && wt?.enabled && wt.state !== "connected" && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          Tip: open Engine Driver / WiThrottle and connect to the layout’s
          WiThrottle server on the same Wi-Fi.
        </p>
      )}

      <button
        onClick={() => router.refresh()}
        className="w-full rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-200 active:bg-slate-800"
      >
        Reconnect
      </button>
      <button
        onClick={leave}
        className="w-full rounded-xl border border-red-900 py-3 text-sm font-medium text-red-300 active:bg-red-950/40"
      >
        Leave session
      </button>
    </div>
  );
}
