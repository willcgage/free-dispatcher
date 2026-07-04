"use client";

import { useEffect, useRef, useState } from "react";

export interface CatalogModule {
  recordNumber: string;
  moduleName: string;
  category: string | null;
  geometryType: string | null;
  lengthFeet?: number | null;
  lengthInches?: number | null;
  endplateCount: number | null;
  hasMss: boolean | null;
}

/** Type-ahead picker over the synced Module Repository catalog. */
export function ModulePicker({
  catalog,
  value,
  onChange,
}: {
  catalog: CatalogModule[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the field in sync when the parent clears the value (e.g. after add).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value === "") setQuery("");
  }, [value]);

  const filtered = query.trim()
    ? catalog.filter(
        (m) =>
          m.recordNumber.toLowerCase().includes(query.toLowerCase()) ||
          m.moduleName.toLowerCase().includes(query.toLowerCase()),
      )
    : catalog;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(m: CatalogModule) {
    onChange(m.recordNumber);
    setQuery(`${m.recordNumber} — ${m.moduleName}`);
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative flex-1">
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        placeholder={
          catalog.length > 0 ? "Search by record # or name…" : "No catalog — sync first"
        }
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          {filtered.slice(0, 50).map((m) => (
            <li key={m.recordNumber}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800"
                onMouseDown={() => select(m)}
              >
                <span className="shrink-0 font-mono text-slate-400">
                  {m.recordNumber}
                </span>
                <span className="truncate text-slate-200">{m.moduleName}</span>
                {m.category && (
                  <span className="ml-auto shrink-0 text-xs text-slate-500">
                    {m.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
