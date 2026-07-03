"use client";

import { useFdSession } from "@/lib/client/useFdSession";
import { TrackBoard } from "@/components/track/TrackBoard";

export default function AdminTrack() {
  const { state, connected } = useFdSession();
  const trains = state?.trains ?? [];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Track</h1>
        <span
          className={`text-xs ${connected ? "text-emerald-400" : "text-amber-400"}`}
        >
          {connected ? "● live" : "○ reconnecting"}
        </span>
      </div>
      <p className="text-sm text-slate-400">
        Mark Block occupancy and allocate Sections to trains. Changes broadcast
        live to every connected screen.
      </p>
      {!state?.session ? (
        <p className="text-sm text-slate-400">
          No active session.{" "}
          <a href="/admin/session" className="text-sky-400 hover:underline">
            Create one →
          </a>
        </p>
      ) : (
        <TrackBoard trains={trains} canControl />
      )}
    </div>
  );
}
