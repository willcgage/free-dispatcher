/**
 * Modular standard slugs and their display labels (#123). The Module Repository
 * is multi-standard; a layout is built to one standard and its module catalog is
 * filtered to it. Slugs mirror the upstream `module_standards.value`.
 */

/** Known standard slugs → display labels. Unknown slugs fall back to the slug. */
export const STANDARD_LABELS: Record<string, string> = {
  freemon: "Free-moN",
  ttrak: "T-Trak",
};

/** Default standard for a new layout when none is chosen. */
export const DEFAULT_STANDARD = "freemon";

/** Human label for a standard slug (e.g. "freemon" → "Free-moN"). */
export function standardLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return STANDARD_LABELS[slug] ?? slug;
}

/**
 * The standard slugs to offer in the New-layout picker: every known standard
 * plus any others present in the synced catalog, so newly-added standards show
 * up without a code change.
 */
export function standardOptions(
  catalog: { standard: string | null }[],
): string[] {
  const set = new Set<string>(Object.keys(STANDARD_LABELS));
  for (const m of catalog) if (m.standard) set.add(m.standard);
  return [...set];
}
