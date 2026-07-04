import type { CatalogModule } from "./types";

/**
 * Case-insensitive match of a query against a module's searchable fields —
 * record #, name, category and geometry. (Owner joins this list once the Module
 * Repository export includes it.) Pure so it can be unit-tested.
 */
export function moduleMatches(m: CatalogModule, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.recordNumber, m.moduleName, m.category, m.geometryType].some(
    (f) => f != null && f.toLowerCase().includes(q),
  );
}
