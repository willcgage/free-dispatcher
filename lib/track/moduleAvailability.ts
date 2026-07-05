/**
 * Module availability (#155/#158) — whether a synced Module Repository record
 * may be placed in layouts. Two signals combine:
 *   - the tombstone (removed_from_repo_at): the record vanished from the repo;
 *   - the owner's status: "active" | "inactive" | "archived" — only active
 *     modules are offered (missing/unknown status counts as active so older
 *     data isn't punished).
 * Pure so it can be unit-tested and shared by API filters and the UI.
 */

export type UnavailableReason = "removed" | "inactive" | "archived";

export function moduleUnavailability(m: {
  removedFromRepoAt?: string | Date | null;
  status?: string | null;
}): UnavailableReason | null {
  if (m.removedFromRepoAt) return "removed";
  const s = (m.status ?? "").trim().toLowerCase();
  if (s === "inactive") return "inactive";
  if (s === "archived") return "archived";
  return null;
}

export const UNAVAILABLE_LABEL: Record<UnavailableReason, string> = {
  removed: "removed from repo",
  inactive: "inactive in repo",
  archived: "archived in repo",
};

export const UNAVAILABLE_HINT: Record<UnavailableReason, string> = {
  removed:
    "This module was removed from the Module Repository. The layout keeps its data, but it can't be re-added elsewhere.",
  inactive:
    "The owner marked this module inactive in the Module Repository — it may not be available for events.",
  archived:
    "The owner archived this module in the Module Repository — it's no longer offered for layouts.",
};
