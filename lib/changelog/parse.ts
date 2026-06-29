/**
 * Changelog parser — turns the project CHANGELOG.md (Keep a Changelog +
 * release-please output) into structured entries the UI can render without a
 * markdown dependency. Pure (no fs) so it can be unit-tested.
 *
 * Handles both heading styles:
 *   ## [0.8.0](https://…compare…) (2026-06-29)   ← release-please
 *   ## 0.7.0 - 2025-12-26                          ← hand-written
 *   ## [Unreleased]
 * and bullets grouped under `### Features` / `### Bug Fixes` / etc.
 */
export interface ChangelogSection {
  /** e.g. "Features", "Bug Fixes", or null for ungrouped bullets. */
  heading: string | null;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  url: string | null;
  sections: ChangelogSection[];
}

/** A released entry has a semver-number heading (excludes "Unreleased"). */
export function isReleased(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version.trim());
}

/** Strip markdown links to their label and drop bare commit-sha refs. */
function cleanItem(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/\s*\(\s*[0-9a-f]{7,40}\s*\)/g, "") // drop (deadbee) commit hashes
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseHeading(raw: string): { version: string; date: string | null; url: string | null } {
  let rest = raw.trim();
  let url: string | null = null;

  // [version](url) form
  const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
  if (link) {
    const version = link[1].trim();
    url = link[2].trim();
    rest = link[3].trim();
    const date = rest.match(/(\d{4}-\d{2}-\d{2})/);
    return { version, date: date ? date[1] : null, url };
  }

  // bare "[Unreleased]" or "0.7.0 - 2025-12-26"
  const date = rest.match(/(\d{4}-\d{2}-\d{2})/);
  const version = rest
    .replace(/\(?\d{4}-\d{2}-\d{2}\)?/, "")
    .replace(/[-–]\s*$/, "")
    .replace(/^\[|\]$/g, "")
    .trim();
  return { version: version || rest.replace(/^\[|\]$/g, ""), date: date ? date[1] : null, url };
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let currentHeading: string | null = null;

  /** Append an item to the entry's current section, opening one if needed. */
  const pushItem = (text: string) => {
    if (!entry) return;
    let section = entry.sections[entry.sections.length - 1];
    if (!section || section.heading !== currentHeading) {
      section = { heading: currentHeading, items: [] };
      entry.sections.push(section);
    }
    section.items.push(text);
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const { version, date, url } = parseHeading(h2[1]);
      entry = { version, date, url, sections: [] };
      currentHeading = null;
      entries.push(entry);
      continue;
    }
    if (!entry) continue; // skip the file preamble

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      currentHeading = h3[1].trim();
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      const text = cleanItem(bullet[1]);
      if (text) pushItem(text);
    }
  }

  // Drop entries with no actual content (e.g. an empty Unreleased heading).
  return entries.filter((e) => e.sections.some((s) => s.items.length > 0));
}
