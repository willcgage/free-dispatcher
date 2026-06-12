"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend, setToken } from "@/lib/client/api";
import { setOperator, HOME_BY_ROLE } from "@/lib/client/operator";
import type { OperatorRole } from "@/lib/db/schema";
import type { FullState } from "@/lib/client/types";

const ROLES: { role: OperatorRole; label: string; blurb: string; icon: string }[] = [
  { role: "dispatcher", label: "Dispatcher", blurb: "Train orders & authority", icon: "🎛" },
  { role: "engineer", label: "Engineer", blurb: "Run an assigned train", icon: "🚂" },
  { role: "yardmaster", label: "Yardmaster", blurb: "Yard track assignments", icon: "🏗" },
];

export default function JoinPage() {
  const router = useRouter();
  const [role, setRole] = useState<OperatorRole | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!role || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{
        sessionToken: string;
        deviceId: string;
        operatorId: string;
        state: FullState;
      }>("POST", "/api/session/join", { name: name.trim(), role });
      setToken(res.sessionToken);
      setOperator({
        role,
        name: name.trim(),
        deviceId: res.deviceId,
        operatorId: res.operatorId,
      });
      router.replace(HOME_BY_ROLE[role]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "join failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Free Dispatcher</h1>
        <p className="mt-1 text-slate-400">Join the operating session</p>
      </div>

      {!role ? (
        <div className="space-y-3">
          <p className="mb-2 text-sm font-medium text-slate-300">Pick your role</p>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => setRole(r.role)}
              className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 text-left active:bg-slate-800"
            >
              <span className="text-3xl">{r.icon}</span>
              <span>
                <span className="block text-lg font-semibold">{r.label}</span>
                <span className="block text-sm text-slate-400">{r.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setRole(null)}
            className="text-sm text-slate-400"
          >
            ← Change role
          </button>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
            <p className="mb-3 text-sm text-slate-300">
              Joining as <span className="font-semibold capitalize text-sky-400">{role}</span>
            </p>
            <input
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-slate-100 placeholder-slate-500"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-200">
              {error === "no active session"
                ? "No active session — ask the admin to start one."
                : error}
            </p>
          )}
          <button
            disabled={busy || !name.trim()}
            onClick={join}
            className="w-full rounded-xl bg-sky-600 py-4 text-lg font-bold text-white active:bg-sky-700 disabled:opacity-40"
          >
            {busy ? "Joining…" : "Join session"}
          </button>
        </div>
      )}
    </div>
  );
}
