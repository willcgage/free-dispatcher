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

interface ModuleRepoAuthStatus {
  authenticated: boolean;
  sessionExpired: boolean;
  email?: string;
  tokenExpiresAt?: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wtStatus, setWtStatus] = useState<WtStatus | null>(null);

  const [repoAuth, setRepoAuth] = useState<ModuleRepoAuthStatus | null>(null);
  const [repoEmail, setRepoEmail] = useState("");
  const [repoPassword, setRepoPassword] = useState("");
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ settings: Settings }>("/api/settings")
      .then((r) => setSettings(r.settings ?? {}))
      .catch(() => {});
    const poll = () =>
      apiGet<WtStatus>("/api/withrottle").then(setWtStatus).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);

    apiGet<ModuleRepoAuthStatus>("/api/modules/auth")
      .then(setRepoAuth)
      .catch(() => {});

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
      const r = await apiSend<{ settings: Settings }>("PUT", "/api/settings", partial);
      setSettings(r.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function repoSignIn(e: React.FormEvent) {
    e.preventDefault();
    setRepoBusy(true);
    setRepoError(null);
    try {
      await apiSend("POST", "/api/modules/auth", { email: repoEmail, password: repoPassword });
      setRepoPassword("");
      const status = await apiGet<ModuleRepoAuthStatus>("/api/modules/auth");
      setRepoAuth(status);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setRepoBusy(false);
    }
  }

  async function repoSignOut() {
    setRepoBusy(true);
    try {
      await apiSend("DELETE", "/api/modules/auth", undefined);
      setRepoAuth({ authenticated: false, sessionExpired: false });
      setRepoEmail("");
    } catch {
      // ignore
    } finally {
      setRepoBusy(false);
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

      <Panel title="Module Repository">
        {repoAuth?.authenticated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300">
                Signed in as <span className="font-medium text-white">{repoAuth.email}</span>
              </span>
            </div>
            <button
              disabled={repoBusy}
              onClick={repoSignOut}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {repoAuth?.sessionExpired && (
              <div className="rounded-md border border-amber-700 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
                Your Module Repository session expired. Please sign in again.
              </div>
            )}
            {repoError && (
              <div className="rounded-md border border-red-700 bg-red-900/20 px-3 py-2 text-sm text-red-300">
                {repoError.includes("show_master") ? (
                  <>
                    {repoError} — ask a Module Repository admin to grant you show_master access.
                  </>
                ) : (
                  repoError
                )}
              </div>
            )}
            <p className="text-sm text-slate-400">
              Sign in with your Module Repository account to sync the module catalog.
              Your account must have show_master access.
            </p>
            <form onSubmit={repoSignIn} className="space-y-2">
              <div>
                <label className={label}>Email</label>
                <input
                  className={input}
                  type="email"
                  autoComplete="email"
                  value={repoEmail}
                  onChange={(e) => setRepoEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>Password</label>
                <input
                  className={input}
                  type="password"
                  autoComplete="current-password"
                  value={repoPassword}
                  onChange={(e) => setRepoPassword(e.target.value)}
                  required
                />
              </div>
              <button
                disabled={repoBusy}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {repoBusy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        )}
      </Panel>

      <Panel title="WiThrottle integration">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Server host</label>
            <input
              className={input}
              placeholder="192.168.1.10"
              value={wt.host ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, withrottle: { ...wt, host: e.target.value } })
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
                setSettings({ ...settings, withrottle: { ...wt, enabled: e.target.checked } })
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
