"use client";

/**
 * Comms — in-app WebRTC push-to-talk (Option A; replaces the Zello placeholder).
 *
 * Channels are session-local and resolved by the operator's role. Enabling
 * voice acquires the mic (PTT-gated), connects to the channel's signaling, and
 * meshes with the other operators on it. Talk indicators for everyone on the
 * session arrive over the app SSE stream (`voice_talk`), so the roster shows
 * who is speaking even before their audio is routed.
 */
import { useEffect, useState } from "react";
import { getOperator, type Operator } from "@/lib/client/operator";
import { useFdSession } from "@/lib/client/useFdSession";
import { useVoiceChannel } from "@/lib/voice/useVoiceChannel";
import {
  channelsForRole,
  defaultChannelForRole,
  type VoiceChannel,
} from "@/lib/voice/channels";

export default function CommsScreen() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [channel, setChannel] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const { talking } = useFdSession();

  // Identity is in sessionStorage — read after mount (MobileShell gates entry).
  useEffect(() => {
    const op = getOperator();
    setOperator(op);
    if (op) setChannel(defaultChannelForRole(op.role));
  }, []);

  const channels: VoiceChannel[] = operator ? channelsForRole(operator.role) : [];

  const voice = useVoiceChannel({
    operatorId: operator?.operatorId ?? "",
    name: operator?.name ?? "operator",
    channel,
    enabled: enabled && !!operator && !!channel,
  });

  // Spacebar = PTT while voice is live (desktop convenience).
  const { micReady, pttDown, pttUp } = voice;
  useEffect(() => {
    if (!enabled || !micReady) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTyping(e)) {
        e.preventDefault();
        pttDown();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e)) {
        e.preventDefault();
        pttUp();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled, micReady, pttDown, pttUp]);

  if (!operator) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Comms</h1>
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const activeLabel = channels.find((c) => c.id === channel)?.label ?? channel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Comms</h1>
        {enabled && (
          <button
            onClick={() => setEnabled(false)}
            className="text-sm text-red-400 active:text-red-300"
          >
            Leave voice
          </button>
        )}
      </div>

      {!voice.secure && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          ⚠️ Microphone needs a secure context. Works on <code>localhost</code>;
          on a phone over the LAN it needs HTTPS (tracked in #23).
        </div>
      )}

      {/* Channel picker */}
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => {
          const active = c.id === channel;
          const someoneTalking = Object.values(talking).some(
            (t) => t.channel === c.id,
          );
          return (
            <button
              key={c.id}
              onClick={() => setChannel(c.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                active
                  ? "border-sky-500 bg-sky-600/20 text-sky-300"
                  : "border-slate-700 bg-slate-900/60 text-slate-300"
              }`}
            >
              {someoneTalking && <span className="text-xs">🔊</span>}
              {c.label}
            </button>
          );
        })}
      </div>

      {!enabled ? (
        <button
          onClick={() => setEnabled(true)}
          className="w-full rounded-xl bg-sky-600 py-4 text-lg font-bold text-white active:bg-sky-700"
        >
          🎙 Enable voice — {activeLabel}
        </button>
      ) : voice.error ? (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {voice.error}
        </div>
      ) : !voice.micReady ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          Requesting microphone…
        </div>
      ) : (
        <button
          onPointerDown={voice.pttDown}
          onPointerUp={voice.pttUp}
          onPointerLeave={voice.pttUp}
          className={`w-full select-none rounded-2xl py-8 text-xl font-bold text-white transition-colors ${
            voice.talking ? "bg-green-600" : "bg-slate-700 active:bg-slate-600"
          }`}
          style={{ touchAction: "none" }}
        >
          {voice.talking ? "🎙 TALKING — release to stop" : "Hold to talk"}
          <span className="mt-1 block text-xs font-normal opacity-70">
            on {activeLabel} · or hold Space
          </span>
        </button>
      )}

      {/* Roster */}
      {enabled && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            On {activeLabel}
          </h2>
          {/* Self */}
          <Row
            name={`${operator.name} (you)`}
            talking={voice.talking}
            state={voice.micReady ? "ready" : "connecting"}
          />
          {voice.peers.length === 0 && (
            <p className="px-1 text-sm text-slate-500">
              No one else on this channel yet.
            </p>
          )}
          {voice.peers.map((p) => (
            <Row
              key={p.id}
              name={p.name}
              talking={!!talking[p.id]}
              state={p.state}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function Row({
  name,
  talking,
  state,
}: {
  name: string;
  talking: boolean;
  state: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
        talking
          ? "border-green-600 bg-green-600/15 text-green-200"
          : "border-slate-800 bg-slate-900/50 text-slate-200"
      }`}
    >
      <span className="font-medium">
        {talking ? "🔊 " : ""}
        {name}
      </span>
      <span
        className={`text-xs ${
          state === "connected" || state === "ready"
            ? "text-green-400"
            : "text-amber-400"
        }`}
      >
        {state}
      </span>
    </div>
  );
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
