# Free Dispatcher

Train operations for modular Free-moN sessions — a **browser-only, local-first**
dispatch tool. One laptop runs the host; operators join from their phones over
the venue Wi-Fi (no app install, no cloud, no internet required for core
dispatch).

- **Host:** Next.js (App Router) + an embedded Postgres (PGlite) database, all
  in-process — nothing to install or start beyond the app itself.
- **Clients:** any phone/tablet/laptop browser on the same LAN. Join by mDNS
  auto-discovery, QR code, or a typed URL.
- **Realtime:** Server-Sent Events. **RBAC:** Admin / Dispatcher / Engineer /
  Yardmaster, enforced server-side.

> **Voice / push-to-talk is not part of the app right now.** An earlier WebRTC
> PTT feature was removed pending a better cross-device solution; see Phase 5 in
> [`docs/V2_BUILD_PLAN.md`](docs/V2_BUILD_PLAN.md).

The full design rationale and phase history is in
[`docs/V2_BUILD_PLAN.md`](docs/V2_BUILD_PLAN.md).

---

## Quick start (single machine)

Requires **Node.js 20+** and npm.

```bash
npm install
cp .env.example .env.local      # then edit (see Configuration below)
npm run db:migrate              # create the local PGlite database
npm run db:seed                 # optional: demo session + trains
npm run dev                     # http://localhost:3000
```

Open <http://localhost:3000>:

- **Admin console** → `/admin` (host only — needs `SERVER_MODE=true`)
- **Join as operator** → `/join`

To test with other devices on the LAN, see
[Multi-device testing](docs/MULTI_DEVICE_TESTING.md).

---

## Configuration

Copy `.env.example` to `.env.local` (gitignored) and set values. All are
read server-side; Next.js loads `.env.local` for both `dev` and `start`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `SERVER_MODE` | host only | `true` enables mDNS advertisement + the Admin console. Omit on client devices. |
| `PORT` | host | Server port (default `3000`). |
| `FD_TOKEN_SECRET` | host | HMAC secret for session tokens. Default is insecure — set a random value for real events (`openssl rand -hex 32`). |
| `FD_DB_DIR` | host | PGlite data directory (default `./.data/freedispatcher`). |
| `NEXT_PUBLIC_WITHROTTLE_HOST` / `_PORT` / `WITHROTTLE_ENABLED` | host | Optional JMRI / DCC-EX WiThrottle monitor. |

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server at `http://localhost:3000`. |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run lint` | ESLint. |
| `npm run electron:dev` | Build + launch the desktop **host app** (Electron) locally. |
| `npm run dist` | Build cross-platform installers into `dist/` (electron-builder). |
| `npm run db:generate` | Generate a Drizzle migration from schema changes. |
| `npm run db:migrate` | Apply migrations to the local DB. |
| `npm run db:seed` | Seed a demo session. |

---

## How a session works

1. **Host** sets `SERVER_MODE=true`, runs the server, opens `/admin`, and
   **creates a session** (Admin → Session). Only one session is active at a time.
2. **Operators** open the host URL on their device, go to `/join`, pick a role
   and a name, and land on their role's home screen.
3. The host's Admin header shows the **join URL + QR code** (`/api/server-info`)
   so operators can scan to connect.

---

## Desktop app (host)

The host can run as a double-click desktop app instead of `npm` — an Electron
shell (`electron/`) that bundles the standalone server, uses a per-user data
directory, runs DB migrations on launch, and shows a control panel with the
**join URL + QR**. Operators still just open a browser.

- **Run locally:** `npm run electron:dev`
- **Build installers:** `npm run dist` → `dist/` (NSIS for Windows, dmg for
  macOS, AppImage/deb for Linux). Build on each target OS — macOS notarization
  requires a Mac.
- **Code signing:** macOS builds are signed + notarized via an App Store Connect
  API key (`APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`); Windows is
  unsigned for now (SmartScreen click-through). Full setup in
  [docs/SIGNING.md](docs/SIGNING.md).

Packaging config is the `build` block in `package.json`.

## Documentation

- [Multi-device testing guide](docs/MULTI_DEVICE_TESTING.md) — run the host and
  join phones/tablets over the LAN.
- [v2 build plan](docs/V2_BUILD_PLAN.md) — architecture, decisions, phase log.
- [Git LFS guide](docs/GIT_LFS_GUIDE.md).
