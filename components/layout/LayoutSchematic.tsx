/**
 * LayoutSchematic (#115, phase 1) — a to-scale linear view of a layout's module
 * sequence. Each module is drawn proportional to its total length; staging
 * modules are tinted, MSS is dotted, and modules with no catalogued length fall
 * back to a default width (marked "?"). Geometry-aware (curved) rendering is a
 * later phase.
 */
"use client";

export interface SchematicModule {
  id: string;
  moduleId: string;
  moduleName: string | null;
  stagingEnd: "A" | "B" | null;
  lengthTotalInches: number | null;
  hasMss: boolean | null;
}

const DEFAULT_LEN = 24; // fallback inches for a module missing a length

export function LayoutSchematic({ modules }: { modules: SchematicModule[] }) {
  if (modules.length === 0) {
    return <p className="text-xs text-slate-600">No modules to draw yet.</p>;
  }

  const lengths = modules.map((m) =>
    m.lengthTotalInches && m.lengthTotalInches > 0
      ? m.lengthTotalInches
      : DEFAULT_LEN,
  );
  const total = lengths.reduce((a, b) => a + b, 0);
  const feet = Math.round((total / 12) * 10) / 10;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>
          {modules.length} module{modules.length === 1 ? "" : "s"}
        </span>
        <span>{feet} ft total</span>
      </div>
      <div className="flex h-16 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900">
        {modules.map((m, i) => {
          const noLen = !(m.lengthTotalInches && m.lengthTotalInches > 0);
          return (
            <div
              key={m.id}
              title={`${m.moduleName ?? m.moduleId} · ${m.moduleId}${
                noLen ? " · no length" : ` · ${Math.round(lengths[i])}"`
              }`}
              style={{ width: `${(lengths[i] / total) * 100}%` }}
              className={`relative flex min-w-0 flex-col justify-center border-r border-slate-700 px-1 last:border-r-0 ${
                m.stagingEnd ? "bg-indigo-900/40" : "bg-slate-800/60"
              }`}
            >
              <span className="truncate text-[10px] font-medium text-slate-200">
                {m.moduleName ?? m.moduleId}
              </span>
              <span className="truncate text-[9px] text-slate-500">
                {m.moduleId}
              </span>
              {m.stagingEnd && (
                <span className="absolute right-0.5 top-0.5 rounded bg-indigo-600/40 px-0.5 text-[8px] text-indigo-200">
                  stg {m.stagingEnd}
                </span>
              )}
              {m.hasMss && (
                <span
                  title="MSS"
                  className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                />
              )}
              {noLen && (
                <span
                  title="No length in catalog"
                  className="absolute left-0.5 top-0.5 text-[8px] text-amber-400"
                >
                  ?
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        To scale by module length. Modules with no catalogued length use a
        default width (?).
      </p>
    </div>
  );
}
