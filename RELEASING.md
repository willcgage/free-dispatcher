# Releasing Free-Dispatcher

Free-Dispatcher follows [Semantic Versioning](https://semver.org/). While we are on
the **0.x** line the app is pre-1.0: behavior and storage formats may change between
minor versions, and a bump to `0.(N+1).0` can carry breaking changes.

**Stable releases are automated via [release-please](https://github.com/googleapis/release-please);
betas are a manual tag.** Either way the
[`Package installers`](.github/workflows/package.yml) workflow builds signed installers for
Windows / macOS / Linux and publishes a GitHub Release. You do not hand-edit version
numbers to ship — release-please bumps them for stable, and the tag drives them for betas.

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

On `main`, `package.json` reflects the **last released** version (release-please updates it
in the release PR). For a beta build the tag temporarily overrides it (electron-builder
sets the version from the tag); the committed value isn't touched.

## When to bump what (0.x rules)

- **Breaking** change (data migration required, incompatible behavior) → bump the
  **minor**: `0.7.x` → `0.8.0`.
- **Feature**, backwards-compatible → also minor on 0.x (there's no separate "major"
  signal pre-1.0).
- **Bug fix** only → bump the **patch**: `0.8.0` → `0.8.1`.

When the app is stable enough to promise compatibility, cut `1.0.0` and switch to
normal SemVer (breaking → major).

## Cutting a release

### Stable releases — automated (release-please)

Stable releases are driven by **Conventional Commits** (see [CONTRIBUTING.md](CONTRIBUTING.md)),
not hand-tagging:

1. Land PRs to `main` with Conventional Commit titles (`feat:`, `fix:`, `feat!:`, …).
2. [`release-please`](https://github.com/googleapis/release-please) opens and keeps a
   **release PR** updated — it bumps the version in `package.json`, regenerates
   [CHANGELOG.md](CHANGELOG.md), and reflects the next version in its title.
3. When you're ready to ship, **merge the release PR.** release-please creates the
   `vX.Y.Z` tag + GitHub Release, then dispatches [`package.yml`](.github/workflows/package.yml)
   to build installers and attach them to that release.

You don't edit the version or changelog by hand for stable releases — merging the release
PR is the whole action. The `0.x` rules above are enforced by the release-please config
(`bump-minor-pre-major`): breaking changes bump the minor until we cut `1.0.0`.

> **Bootstrapping note:** the first release-please PR runs against a repo with pre-existing
> beta tags and an untagged `0.7.0`, so **review its proposed version + changelog before
> merging.** To pin the first stable explicitly, land a commit whose body contains
> `Release-As: 0.8.0`.

### Beta releases — manual tag

Betas are the one manual step — push a pre-release tag and `package.yml` builds + publishes
it as a GitHub **pre-release**:

```bash
git tag v0.8.0-beta.1
git push origin v0.8.0-beta.1
```

A beta cycle typically looks like: `v0.8.0-beta.1` → fixes → `v0.8.0-beta.2` → … → the
stable `v0.8.0` (via the release PR) once it's solid. Confirm a beta shows as
**Pre-release** on the Releases page.

## Branching

We use GitHub Flow: `main` is always releasable. Contributors branch off `main`, open
a PR (CI must pass), and merge. Releases are just tags on `main` — there is no
long-lived `develop` or `release` branch.

## Signing

Installer signing activates automatically when the per-platform secrets are present;
builds are unsigned otherwise (so forks still build). See [docs/SIGNING.md](docs/SIGNING.md).
