# Releasing Free-Dispatcher

Free-Dispatcher follows [Semantic Versioning](https://semver.org/). While we are on
the **0.x** line the app is pre-1.0: behavior and storage formats may change between
minor versions, and a bump to `0.(N+1).0` can carry breaking changes.

**The git tag is the single source of truth for a release.** The
[`Package installers`](.github/workflows/package.yml) workflow rewrites the version
from the tag, builds signed installers for Windows / macOS / Linux, and publishes a
GitHub Release. You do not hand-edit version numbers to ship — you tag.

## Version scheme

| Kind | Tag | Example | GitHub Release |
| --- | --- | --- | --- |
| Stable | `vX.Y.Z` | `v0.8.0` | latest |
| Beta | `vX.Y.Z-beta.N` | `v0.8.0-beta.1` | pre-release |
| Release candidate | `vX.Y.Z-rc.N` | `v0.8.0-rc.1` | pre-release |

These order the way you'd expect:
`0.8.0-beta.1 < 0.8.0-beta.2 < 0.8.0-rc.1 < 0.8.0`. Any tag **with a hyphen** is
treated as a pre-release and published as a GitHub pre-release, so it never becomes
"latest" and stable users aren't offered it.

On `main`, `package.json` carries the **next** target with a `-dev` suffix (e.g.
`0.8.0-dev`) purely as a marker. The shipped number always comes from the tag.

## When to bump what (0.x rules)

- **Breaking** change (data migration required, incompatible behavior) → bump the
  **minor**: `0.7.x` → `0.8.0`.
- **Feature**, backwards-compatible → also minor on 0.x (there's no separate "major"
  signal pre-1.0).
- **Bug fix** only → bump the **patch**: `0.8.0` → `0.8.1`.

When the app is stable enough to promise compatibility, cut `1.0.0` and switch to
normal SemVer (breaking → major).

## Cutting a release

1. **Land the work.** Every PR updates the `## [Unreleased]` section of
   [CHANGELOG.md](CHANGELOG.md) under Added / Changed / Fixed / Removed.
2. **Roll the changelog.** Rename `## [Unreleased]` to `## X.Y.Z - YYYY-MM-DD`, and add a
   fresh empty `## [Unreleased]` above it. Commit.
3. **Set the dev marker** in `package.json` to the *next* target, e.g. `0.9.0-dev`,
   in the same commit.
4. **Tag and push:**
   ```bash
   git tag v0.8.0            # stable
   # or
   git tag v0.8.0-beta.1     # beta -> publishes as a GitHub pre-release
   git push origin v0.8.0
   ```
5. CI builds installers and publishes the GitHub Release automatically. For a beta,
   confirm it shows as **Pre-release** on the Releases page.

A beta cycle typically looks like: `v0.8.0-beta.1` → fixes → `v0.8.0-beta.2` → … →
`v0.8.0` once it's solid.

## Branching

We use GitHub Flow: `main` is always releasable. Contributors branch off `main`, open
a PR (CI must pass), and merge. Releases are just tags on `main` — there is no
long-lived `develop` or `release` branch.

## Signing

Installer signing activates automatically when the per-platform secrets are present;
builds are unsigned otherwise (so forks still build). See [docs/SIGNING.md](docs/SIGNING.md).
