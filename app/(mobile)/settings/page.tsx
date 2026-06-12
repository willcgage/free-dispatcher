"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiGet } from "@/lib/client/api";
import {
  getOperator,
  clearOperator,
  getZelloCreds,
  setZelloCreds,
  clearZelloCreds,
} from "@/lib/client/operator";
import { useZello } from "@/hooks/useZello";

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
  const { activeChannel } = useZello();
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

  // Optional Zello talk login (device-local) — enables in-app PTT.
  const existingCreds = getZelloCreds();
  const [zUser, setZUser] = useState(existingCreds?.username ?? "");
  const [zPass, setZPass] = useState("");
  const talkEnabled = Boolean(existingCreds);

  function saveZello() {
    if (!zUser.trim() || !zPass) return;
    setZelloCreds({ username: zUser.trim(), password: zPass });
    window.location.reload(); // reconnect Zello with the named account
  }
  function clearZello() {
    clearZelloCreds();
    window.location.reload();
  }

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
        <Row label="Zello channel" value={activeChannel ?? "—"} />
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

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Zello voice</h2>
        <p className="mt-1 text-xs text-slate-400">
          {talkEnabled
            ? `Talk enabled as ${existingCreds?.username}.`
            : "Listen-only. Add your own Zello login to talk in-app (needs HTTPS + channel membership), or use the standalone Zello app."}
        </p>
        {talkEnabled ? (
          <button
            onClick={clearZello}
            className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-200 active:bg-slate-800"
          >
            Switch to listen-only
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Zello username"
              autoComplete="off"
              value={zUser}
              onChange={(e) => setZUser(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Zello password (stored on this device only)"
              autoComplete="off"
              value={zPass}
              onChange={(e) => setZPass(e.target.value)}
            />
            <button
              onClick={saveZello}
              disabled={!zUser.trim() || !zPass}
              className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white active:bg-sky-700 disabled:opacity-40"
            >
              Enable in-app talk
            </button>
          </div>
        )}
      </section>

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
