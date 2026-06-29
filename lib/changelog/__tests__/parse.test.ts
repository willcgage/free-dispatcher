import { describe, it, expect } from "vitest";
import { parseChangelog, isReleased, compareVersions } from "../parse";

const SAMPLE = `# Changelog

Preamble paragraph that should be ignored. See [CONTRIBUTING.md](CONTRIBUTING.md).

## [Unreleased]

A prose note that is not a bullet.

## [0.8.0](https://github.com/o/r/compare/v0.7.0...v0.8.0) (2026-06-29)

### Features

* in-app auto-update ([#52](https://x/52)) ([#61](https://x/61)) ([649fd1c](https://x/c))
* session archiving ([#57](https://x/57))

### Bug Fixes

* ship the anon key so login works ([#56](https://x/56))

## 0.7.0 - 2025-12-26
- Added Electron shell and IPC backend resolution.
- Bundled FastAPI backend.
`;

describe("parseChangelog", () => {
  const entries = parseChangelog(SAMPLE);

  it("drops the preamble and the empty Unreleased entry", () => {
    expect(entries.map((e) => e.version)).toEqual(["0.8.0", "0.7.0"]);
  });

  it("parses release-please version, date, and compare url", () => {
    const v8 = entries[0];
    expect(v8.date).toBe("2026-06-29");
    expect(v8.url).toContain("compare/v0.7.0...v0.8.0");
    expect(v8.sections.map((s) => s.heading)).toEqual(["Features", "Bug Fixes"]);
  });

  it("strips markdown links and commit-sha noise from items", () => {
    const features = entries[0].sections[0].items;
    expect(features[0]).toBe("in-app auto-update (#52) (#61)");
    expect(features[1]).toBe("session archiving (#57)");
  });

  it("parses the hand-written '0.7.0 - date' heading with ungrouped bullets", () => {
    const v7 = entries[1];
    expect(v7.version).toBe("0.7.0");
    expect(v7.date).toBe("2025-12-26");
    expect(v7.sections[0].heading).toBeNull();
    expect(v7.sections[0].items).toHaveLength(2);
  });

  it("isReleased keeps semver versions and rejects Unreleased", () => {
    expect(isReleased("0.8.0")).toBe(true);
    expect(isReleased("0.7.0")).toBe(true);
    expect(isReleased("Unreleased")).toBe(false);
    expect(isReleased("[Unreleased]")).toBe(false);
  });

  it("compareVersions orders releases and ignores pre-release tags", () => {
    expect(compareVersions("0.7.0", "0.8.0")).toBeLessThan(0);
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("0.8.0-beta.2", "0.8.0")).toBe(0);
  });
});
