"use client";

import { useRouter } from "next/navigation";
import { useFdSession } from "@/lib/client/useFdSession";
import { getOperator, clearOperator, CHANNEL_DEFAULTS } from "@/lib/client/operator";

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
        <Row
          label="WiThrottle"
          value={<span className="text-slate-500">Phase 4</span>}
        />
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
