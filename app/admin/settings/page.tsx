"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";

interface Settings {
  withrottle?: { host?: string; port?: number; enabled?: boolean };
  zello?: {
    devToken?: string;
    tokenServerUrl?: string;
    username?: string;
    channels?: {
      opsAll?: string;
      mainLine?: string;
      yard?: string;
      dispatch?: string;
    };
  };
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
  const zello = settings.zello ?? {};
  const ch = zello.channels ?? {};
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

      <Panel title="Zello PTT">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Development token (30-day, free tier)</label>
            <textarea
              className={`${input} font-mono text-xs`}
              rows={3}
              placeholder="Paste the Sample Development Token from developers.zello.com"
              value={zello.devToken ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  zello: { ...zello, devToken: e.target.value },
                })
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Free consumer tier — expires every 30 days; re-paste before each event.
              Operators hear comms listen-only; talking uses each operator’s own Zello
              login (Settings) or the standalone Zello app.
            </p>
          </div>
          <div className="col-span-2">
            <label className={label}>Token server URL (optional, self-hosted)</label>
            <input
              className={input}
              placeholder="http://192.168.1.10:3001"
              value={zello.tokenServerUrl ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  zello: { ...zello, tokenServerUrl: e.target.value },
                })
              }
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Zello username</label>
            <input
              className={input}
              value={zello.username ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  zello: { ...zello, username: e.target.value },
                })
              }
            />
          </div>
          {(
            [
              ["opsAll", "FD-OpsAll"],
              ["mainLine", "FD-MainLine"],
              ["yard", "FD-Yard"],
              ["dispatch", "FD-Dispatch"],
            ] as const
          ).map(([key, placeholder]) => (
            <div key={key}>
              <label className={label}>{placeholder}</label>
              <input
                className={input}
                placeholder={placeholder}
                value={ch[key] ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    zello: {
                      ...zello,
                      channels: { ...ch, [key]: e.target.value },
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={() => save({ zello: settings.zello ?? {} })}
          className="mt-3 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Save Zello
        </button>
      </Panel>
    </div>
  );
}
