"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { Panel } from "@/components/admin/ui";
import {
  defaultChannels,
  slugifyChannel,
  type VoiceChannel,
  type ChannelKind,
} from "@/lib/zello/channels";

const KIND_LABEL: Record<ChannelKind, string> = {
  opsall: "All operators",
  dispatch: "Dispatchers",
  district: "District",
  yard: "Yard",
  tech: "Tech services",
};

export default function AdminChannels() {
  const [channels, setChannels] = useState<VoiceChannel[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ settings: { voiceChannels?: VoiceChannel[] } }>("/api/settings")
      .then((r) => {
        const list = r.settings?.voiceChannels;
        setChannels(list && list.length ? list : defaultChannels());
      })
      .catch(() => setChannels(defaultChannels()));
  }, []);

  function update(id: string, patch: Partial<VoiceChannel>) {
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function addDistrict() {
    const n = channels.filter((c) => c.kind === "district").length + 1;
    const label = `District ${n}`;
    setChannels((cs) => [
      ...cs,
      { id: crypto.randomUUID(), label, kind: "district", zelloName: slugifyChannel(label) },
    ]);
  }
  function remove(id: string) {
    setChannels((cs) => cs.filter((c) => c.id !== id));
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await apiSend("PUT", "/api/settings", { voiceChannels: channels });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(name: string) {
    navigator.clipboard?.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }

  const input =
    "rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100";

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">
        Voice channels {saved && <span className="text-sm text-emerald-400">✓ saved</span>}
      </h1>
      <p className="text-sm text-slate-400">
        On the free Zello tier channels are created by hand in the Zello app. Define
        them here per session — Free Dispatcher generates the names and the operator
        access map, then gives you a checklist to create them once.
      </p>

      <Panel
        title="Channels"
        actions={
          <button
            onClick={addDistrict}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          >
            + Add district
          </button>
        }
      >
        <div className="space-y-2">
          {channels.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-xs uppercase text-slate-500">
                {KIND_LABEL[c.kind]}
              </span>
              <input
                className={`${input} flex-1`}
                value={c.label}
                onChange={(e) => {
                  const label = e.target.value;
                  // keep zelloName in sync until the admin edits it manually
                  update(c.id, {
                    label,
                    zelloName:
                      c.zelloName === slugifyChannel(c.label)
                        ? slugifyChannel(label)
                        : c.zelloName,
                  });
                }}
              />
              <input
                className={`${input} w-48 font-mono`}
                value={c.zelloName}
                onChange={(e) => update(c.id, { zelloName: e.target.value })}
              />
              {c.kind === "district" && (
                <button
                  onClick={() => remove(c.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            disabled={busy}
            onClick={save}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Save channels
          </button>
          <button
            onClick={() => setChannels(defaultChannels())}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Reset to defaults
          </button>
        </div>
      </Panel>

      <Panel title="Create these in the Zello app">
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Open the Zello app → create a channel for each name below.</li>
          <li>Set each channel type to “Anyone can talk”.</li>
          <li>Add operators as members (only members can talk; anyone can listen).</li>
        </ol>
        <ul className="space-y-1.5">
          {channels.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <span className="font-mono text-sm text-slate-100">{c.zelloName}</span>
              <span className="text-xs text-slate-500">{c.label}</span>
              <button
                onClick={() => copy(c.zelloName)}
                className="ml-auto rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
              >
                {copied === c.zelloName ? "copied ✓" : "copy"}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
