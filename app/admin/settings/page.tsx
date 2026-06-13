"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";

interface Settings {
  withrottle?: { host?: string; port?: number; enabled?: boolean };
}

interface WtStatus {
  enabled: boolean;
  state: "disconnected" | "connecting" | "connected";
  acquired: { address: number; name: string; trainNumber: string | null }[];
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wtStatus, setWtStatus] = useState<WtStatus | null>(null);

  useEffect(() => {
    apiGet<{ settings: Settings }>("/api/settings")
      .then((r) => setSettings(r.settings ?? {}))
      .catch(() => {});
    const poll = () =>
      apiGet<WtStatus>("/api/withrottle").then(setWtStatus).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  async function controlMonitor(action: "start" | "stop") {
    setBusy(true);
    try {
      const s = await apiSend<WtStatus>("POST", "/api/withrottle", { action });
      setWtStatus(s);
    } catch (e) {
      alert(e instanceof Error ? e.message : "monitor control failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(partial: Settings) {
    setBusy(true);
    setSaved(false);
    try {
      const r = await apiSend<{ settings: Settings }>(
        "PUT",
        "/api/settings",
        partial,
      );
      setSettings(r.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  const wt = settings.withrottle ?? {};
  const input =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";
  const label = "block text-xs uppercase text-slate-500 mb-1";

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">
        Settings {saved && <span className="text-sm text-emerald-400">✓ saved</span>}
      </h1>

      <Panel title="WiThrottle integration">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Server host</label>
            <input
              className={input}
              placeholder="192.168.1.10"
              value={wt.host ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  withrottle: { ...wt, host: e.target.value },
                })
              }
            />
          </div>
          <div>
            <label className={label}>Port</label>
            <input
              className={input}
              placeholder="12090"
              value={wt.port ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  withrottle: { ...wt, port: Number(e.target.value) || undefined },
                })
              }
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={wt.enabled ?? false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  withrottle: { ...wt, enabled: e.target.checked },
                })
              }
            />
            Enable WiThrottle monitoring
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={busy}
            onClick={() => save({ withrottle: settings.withrottle ?? {} })}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Save WiThrottle
          </button>
          <button
            disabled={busy}
            onClick={() => controlMonitor(wtStatus?.enabled ? "stop" : "start")}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {wtStatus?.enabled ? "Stop monitor" : "Start monitor"}
          </button>
          <span className="text-sm">
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                wtStatus?.state === "connected"
                  ? "bg-emerald-400"
                  : wtStatus?.enabled
                    ? "bg-amber-400"
                    : "bg-slate-600"
              }`}
            />
            <span className="text-slate-400">
              {!wtStatus?.enabled
                ? "stopped"
                : wtStatus.state === "connected"
                  ? `connected · ${wtStatus.acquired.length} loco(s)`
                  : wtStatus.state}
            </span>
          </span>
        </div>
      </Panel>

      <Panel title="Voice (PTT)">
        <p className="text-sm text-slate-400">
          Push-to-talk is moving to in-app WebRTC — session-local channels, no
          external account or token to configure. Nothing to set up here yet.
        </p>
      </Panel>
    </div>
  );
}
