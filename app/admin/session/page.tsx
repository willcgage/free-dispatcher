"use client";

import { useCallback, useEffect, useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import type { SessionRow } from "@/lib/client/types";

export default function AdminSession() {
  const { state, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", venue: "" });
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const session = state?.session ?? null;
  const hasActive = sessions.some((s) => s.status === "active");

  const loadSessions = useCallback(async () => {
    try {
      const { sessions } = await apiGet<{ sessions: SessionRow[] }>(
        "/api/sessions",
      );
      setSessions(sessions);
    } catch {
      /* list is best-effort; the active-session panel still works */
    }
  }, []);

  useEffect(() => {
    // loadSessions setStates after an await (not synchronously here); refetch
    // whenever the live session state changes so the list tracks archive/start.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions, state]);

  // Refresh both the live state and the list after any mutation.
  const after = useCallback(async () => {
    await Promise.all([refresh(), loadSessions()]);
  }, [refresh, loadSessions]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (
      session &&
      !confirm(
        `This will archive the current session "${session.name}" and start a new one. Continue?`,
      )
    )
      return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/session", {
        name: form.name,
        date: form.date || undefined,
        venue: form.venue || undefined,
      });
      setForm({ name: "", date: "", venue: "" });
      await after();
    } catch (err) {
      alert(err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  async function archiveActive() {
    if (
      !session ||
      !confirm(
        `Archive "${session.name}"? It will end the active session — you can reactivate it later from Past sessions.`,
      )
    )
      return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/session/archive");
      await after();
    } catch (err) {
      alert(err instanceof Error ? err.message : "archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(s: SessionRow) {
    if (!confirm(`Reactivate "${s.name}" as the active session?`)) return;
    setBusy(true);
    try {
      await apiSend("PATCH", `/api/sessions/${s.id}`);
      await after();
    } catch (err) {
      alert(err instanceof Error ? err.message : "reactivate failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: SessionRow) {
    if (
      !confirm(
        `Permanently delete "${s.name}" and all its trains, operators, and logs? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/sessions/${s.id}`);
      await after();
    } catch (err) {
      alert(err instanceof Error ? err.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";
  const canSubmit = !busy && form.name.trim().length > 0;

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Session management</h1>

      <Panel
        title="Active session"
        actions={
          session ? (
            <button
              disabled={busy}
              onClick={archiveActive}
              className="rounded-md border border-amber-700/60 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-900/30 disabled:opacity-50"
            >
              Archive session
            </button>
          ) : undefined
        }
      >
        {session ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium">{session.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Venue</dt>
              <dd>{session.venue ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Date</dt>
              <dd>{session.date ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Started</dt>
              <dd>{new Date(session.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">No active session.</p>
        )}
      </Panel>

      <Panel title={session ? "Start new session" : "Create session"}>
        <form onSubmit={createSession} className="space-y-3">
          <input
            className={input}
            placeholder="Session name * (e.g. NMRA 2026 Spring Meet)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="flex gap-3">
            <input
              type="date"
              className={input}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <input
              className={input}
              placeholder="Venue"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </div>
          {session && (
            <p className="text-xs text-amber-400">
              Starting a new session archives the current one (only one active at
              a time).
            </p>
          )}
          <button
            disabled={!canSubmit}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {session ? "Archive & start new" : "Create session"}
          </button>
          {!form.name.trim() && (
            <p className="text-xs text-slate-500">
              Enter a session name to continue.
            </p>
          )}
        </form>
      </Panel>

      <Panel title={`Past sessions (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-100">
                      {s.name}
                    </span>
                    {s.status === "active" ? (
                      <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                        active
                      </span>
                    ) : (
                      <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-400">
                        archived
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.venue ?? "—"} · {s.date ?? "—"} ·{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {s.status === "archived" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy || hasActive}
                      onClick={() => reactivate(s)}
                      title={
                        hasActive
                          ? "Archive the active session first"
                          : "Make this the active session"
                      }
                      className="rounded px-2 py-1 text-xs font-medium text-sky-300 hover:bg-sky-900/30 disabled:opacity-40"
                    >
                      Reactivate
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => remove(s)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900/30 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
