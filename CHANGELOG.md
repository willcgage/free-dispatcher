# Changelog

All notable changes will be documented in this file. Follow [Keep a Changelog](https://keepachangelog.com/) principles and [Semantic Versioning](https://semver.org/) when tagging releases.

While on the 0.x line the app is pre-1.0: behavior and storage formats may change between minor versions. Betas are tagged as `vX.Y.Z-beta.N` (SemVer pre-releases) and ship as GitHub pre-releases; stable cuts are tagged `vX.Y.Z`. See [RELEASING.md](RELEASING.md).

## [Unreleased]

Targeting **0.8.0**. Add entries here under Added / Changed / Fixed / Removed as PRs land; on release this heading becomes the version + date.

### Added
- Electron desktop shell packaging across Windows, macOS, and Linux, with code signing wired up (Azure Trusted Signing on Windows, Developer ID + notarization on macOS).
- Tag-driven release pipeline: pushing a `v*` tag builds installers and publishes a GitHub Release; pre-release tags publish as GitHub pre-releases.

## 0.7.0 - 2025-12-26
- Added Electron shell and IPC-based backend URL resolution for the React frontend.
- Bundled FastAPI backend via PyInstaller binary; default to per-user SQLite storage with Postgres override.
- Added Electron packaging config and scripts (`electron:build`, `backend:bundle`).
- Retired Docker-based workflow and removed LAN socat scripts; updated documentation accordingly.
- Ignored PyInstaller artifacts and slimmed packaged assets to include only bundled backend.
