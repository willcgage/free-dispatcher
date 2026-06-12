"use client";

import { useState } from "react";
import { useFdSession } from "@/lib/client/useFdSession";
import { apiSend } from "@/lib/client/api";
import { Panel, StatusBadge } from "@/components/admin/ui";
import type { DccType, EquipmentType } from "@/lib/db/schema";

const EQUIPMENT: EquipmentType[] = ["steam", "diesel", "passenger", "freight"];

export default function AdminTrains() {
  const { state, refresh } = useFdSession();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    number: "",
    name: "",
    dccAddress: "",
    dccType: "short" as DccType,
    owner: "",
    equipmentType: "diesel" as EquipmentType,
  });

  const trains = state?.trains ?? [];
  const operators = state?.operators ?? [];
  const opName = (id: string | null) =>
    id ? (operators.find((o) => o.id === id)?.name ?? "—") : "—";

  async function addTrain(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number.trim()) return;
    setBusy(true);
    try {
      await apiSend("POST", "/api/trains", {
        number: form.number,
        name: form.name || undefined,
        dccAddress: form.dccAddress ? Number(form.dccAddress) : undefined,
        dccType: form.dccType,
        owner: form.owner || undefined,
        equipmentType: form.equipmentType,
      });
      setForm({ ...form, number: "", name: "", dccAddress: "", owner: "" });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "add failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeTrain(id: string) {
    if (!confirm("Remove this train from the roster?")) return;
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/trains/${id}`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!state?.session) {
    return <p className="text-slate-400">No active session.</p>;
  }

  const input =
    "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Train roster</h1>

      <Panel title="Add train">
        <form onSubmit={addTrain} className="flex flex-wrap items-end gap-3">
          <input
            className={input}
            placeholder="Number *"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <input
            className={input}
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className={`${input} w-28`}
            placeholder="DCC addr"
            value={form.dccAddress}
            onChange={(e) => setForm({ ...form, dccAddress: e.target.value })}
          />
          <select
            className={input}
            value={form.dccType}
            onChange={(e) =>
              setForm({ ...form, dccType: e.target.value as DccType })
            }
          >
            <option value="short">short</option>
            <option value="long">long</option>
          </select>
          <input
            className={input}
            placeholder="Owner"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          />
          <select
            className={input}
            value={form.equipmentType}
            onChange={(e) =>
              setForm({ ...form, equipmentType: e.target.value as EquipmentType })
            }
          >
            {EQUIPMENT.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </Panel>

      <Panel title={`Roster (${trains.length})`}>
        {trains.length === 0 ? (
          <p className="text-sm text-slate-400">No trains yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">DCC</th>
                <th className="pb-2">Owner</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Engineer</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {trains.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 font-mono">{t.number}</td>
                  <td className="py-2">{t.name ?? "—"}</td>
                  <td className="py-2 font-mono text-slate-400">
                    {t.dccAddress ?? "—"}
                    {t.dccType ? ` (${t.dccType})` : ""}
                  </td>
                  <td className="py-2 text-slate-400">{t.owner ?? "—"}</td>
                  <td className="py-2 capitalize text-slate-400">
                    {t.equipmentType ?? "—"}
                  </td>
                  <td className="py-2">
                    {t.currentStatus ? (
                      <StatusBadge status={t.currentStatus.status} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 text-slate-400">
                    {opName(t.assignedOperatorId)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      disabled={busy}
                      onClick={() => removeTrain(t.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
