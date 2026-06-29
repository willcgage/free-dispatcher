# Contributing to Free-Dispatcher

Thanks for helping out! This project is pre-1.0 (the **0.x** line) — see
[RELEASING.md](RELEASING.md) for the versioning policy.

## Workflow

We use GitHub Flow: `main` is always releasable.

1. Branch off `main`.
2. Make your change; keep it focused.
3. Open a PR. CI (lint · types · build · tests) must pass.
4. A maintainer reviews and merges.

Run locally before pushing:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Conventional Commits

Commit messages (and squash-merge PR titles) **must** follow
[Conventional Commits](https://www.conventionalcommits.org/). This is what drives
automated releases — [release-please](https://github.com/googleapis/release-please)
reads the commit history to decide the next version and generate the changelog.

Format: `type(optional scope): summary`

| Type | Use for | Release effect (0.x) |
| --- | --- | --- |
| `feat:` | a new feature | bumps the **minor** (`0.8.0` → `0.9.0`) |
| `fix:` | a bug fix | bumps the **patch** (`0.8.0` → `0.8.1`) |
| `feat!:` / `fix!:` | a breaking change (or a `BREAKING CHANGE:` footer) | bumps the **minor** while pre-1.0 (not major) |
| `docs:` `chore:` `refactor:` `test:` `ci:` `build:` `perf:` `style:` | everything else | no release on its own |

Examples:

```
feat: add WiThrottle emergency-stop broadcast
fix(admin): ship the Module Repository anon key so login works
docs: document the release flow
feat!: require Postgres 16 (drops PGlite fallback)
```

Notes:
- We squash-merge, so the **PR title** becomes the commit on `main` — make it a
  valid Conventional Commit. The CHANGELOG is generated from these.
- Breaking changes bump the **minor** while we're on 0.x (per SemVer for
  pre-1.0); after `1.0.0` they'll bump the major.

## Releases

You don't tag stable releases by hand — release-please opens a "release PR" that
maintains the version bump and changelog. Merging it ships the release. Betas are
the one manual step (a maintainer pushes a `v*-beta.N` tag). See
[RELEASING.md](RELEASING.md) for the full picture.
