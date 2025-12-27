# Changelog

All notable changes will be documented in this file. Follow Keep a Changelog principles and Semantic Versioning when tagging releases.

## 0.7.0 - 2025-12-26
- Added Electron shell and IPC-based backend URL resolution for the React frontend.
- Bundled FastAPI backend via PyInstaller binary; default to per-user SQLite storage with Postgres override.
- Added Electron packaging config and scripts (`electron:build`, `backend:bundle`).
- Retired Docker-based workflow and removed LAN socat scripts; updated documentation accordingly.
- Ignored PyInstaller artifacts and slimmed packaged assets to include only bundled backend.

## Unreleased
- (placeholder)
