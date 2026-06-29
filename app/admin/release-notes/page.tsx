"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api";
import type { ChangelogEntry } from "@/lib/changelog/parse";

interface ChangelogResponse {
  version: string;
  entries: ChangelogEntry[];
}

/** True when the running app version belongs to this changelog entry
 *  (exact, or a pre-release of it: 0.8.0-beta.1 / 0.8.0-dev → 0.8.0). */
function isCurrent(entryVersion: string, appVersion: string): boolean {
  return appVersion === entryVersion || appVersion.startsWith(`${entryVersion}-`);
}

export default function ReleaseNotes() {
  const [data, setData] = useState<ChangelogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ChangelogResponse>("/api/changelog")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "failed to load"));
  }, []);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Release notes</h1>
        {data && (
          <span className="text-sm text-slate-400">
            You’re running <span className="text-slate-200">v{data.version}</span>
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-300">Couldn’t load release notes: {error}</p>
      ) : !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data.entries.length === 0 ? (
        <p className="text-sm text-slate-400">No release notes yet.</p>
      ) : (
        <ol className="space-y-4">
          {data.entries.map((e) => {
            const current = isCurrent(e.version, data.version);
            return (
              <li
                key={e.version + (e.date ?? "")}
                className={`rounded-lg border p-4 ${
                  current
                    ? "border-sky-700/60 bg-sky-950/20"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-100">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {e.version}
                      </a>
                    ) : (
                      e.version
                    )}
                  </h2>
                  {current && (
                    <span className="rounded bg-sky-600/20 px-1.5 py-0.5 text-xs font-medium text-sky-300">
                      current
                    </span>
                  )}
                  {e.date && (
                    <span className="ml-auto text-xs text-slate-500">{e.date}</span>
                  )}
                </div>

                {e.sections.map((s, i) => (
                  <div key={i} className="mt-2">
                    {s.heading && (
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {s.heading}
                      </div>
                    )}
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                      {s.items.map((it, j) => (
                        <li key={j}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
