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
- **Voice:** in-app WebRTC push-to-talk with session-local channels (see
  [Comms / voice](#comms--voice-push-to-talk)).

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

On `localhost` everything works, **including the microphone** (it's a secure
context). To use voice from another device you need HTTPS — see
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
| `npm run dev` | Dev server (HTTP) at `http://localhost:3000`. |
| `npm run dev:https` | Dev server over **HTTPS** with a Next-generated self-signed cert — needed to test the microphone from another device. See the testing guide. |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run lint` | ESLint. |
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

### Comms / voice (push-to-talk)

- Channels are **session-local** and filtered by role (Dispatch, Yard, All
  Operators, Tech) — no external account, no global namespace.
- On the Comms screen: tap **Enable voice**, pick a channel, then **hold to
  talk** (or hold `Space` on a laptop). Other operators on the channel — and the
  Admin dashboard — see who's transmitting live.
- **The mic requires a secure context.** It works on `localhost`; on any other
  device it needs HTTPS. See
  [`docs/MULTI_DEVICE_TESTING.md`](docs/MULTI_DEVICE_TESTING.md).

---

## Documentation

- [Multi-device testing guide](docs/MULTI_DEVICE_TESTING.md) — run the host,
  join phones, and the HTTPS options for testing voice across devices.
- [v2 build plan](docs/V2_BUILD_PLAN.md) — architecture, decisions, phase log.
- [Git LFS guide](docs/GIT_LFS_GUIDE.md).
