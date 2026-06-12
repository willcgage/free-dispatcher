"use client";

import { useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";

export default function AdminSession() {
  const { state, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", venue: "" });

  const session = state?.session ?? null;

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
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Session management</h1>

      <Panel title="Active session">
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
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {session ? "Archive & start new" : "Create session"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
