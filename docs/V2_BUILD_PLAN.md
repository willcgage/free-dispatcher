# Free Dispatcher v2 — Phased Build Plan

**Status:** Planning (no code changes yet)
**Date:** 2026-06-12
**Source spec:** `FreeDispatcher_System_Requirements_v2.docx` (v2.0)
**Decision:** Greenfield Next.js rebuild, **local-first database** (cloud not guaranteed at venues).

---

## 0. Why this is a rebuild, not a feature add

The v2 requirements describe a different application than the one in this repo today. The
overlap between the two stacks is near zero:

| Concern        | Current repo                                | v2 target                                      |
| -------------- | ------------------------------------------- | ---------------------------------------------- |
| Shell          | Electron desktop app                        | Browser-only; mobile clients join over Wi-Fi   |
| Frontend       | React 19 + Vite SPA                         | Next.js App Router + TypeScript + Tailwind     |
| Backend        | FastAPI + SQLAlchemy (PyInstaller binary)   | Next.js API routes (`app/api/*/route.ts`)      |
| Realtime       | none                                        | Server-Sent Events (`/api/events`)             |
| Domain model   | Layouts · Districts · Dispatchers           | Sessions · Trains · Operators · Authority      |
| Roles / RBAC   | none                                        | Admin / Dispatcher / Engineer / Yardmaster     |
| New subsystems | —                                           | mDNS+QR join · WiThrottle monitor · Zello PTT  |

**What carries over:** the Module Repository concept from the recent M6 work. v2 keeps a
Module Repository (`module_layouts.module_id` is "FK to module repository"; the Admin
"Module layout configuration" screen selects from it). The *sync-from-external-source*
idea survives; the FastAPI/SQLite implementation does not.

**Recommendation:** preserve the current Electron/FastAPI app on a branch or tag
(e.g. `archive/electron-v0.7`) for reference, then build v2 fresh. Do **not** try to grow
the new design inside the old codebase — the file manifest, runtime, and data model all
diverge.

---

## 1. Key architecture decision: local-first database

The spec names **Supabase (cloud PostgreSQL)** as the data store, but also states core
dispatch must work with no internet ("There is no cloud dependency for core dispatch
operations"). At a venue, Wi-Fi may have no uplink. **The operational session database
must live on the host machine and require no internet.**

This is low-risk because *nothing load-bearing in the spec needs Supabase's cloud
features*:

- **Realtime** is implemented with the spec's own **SSE** endpoint, not Supabase Realtime.
- **RBAC** is "enforced server-side" inside API routes, not Supabase Row-Level Security.
- **Clients never touch the DB directly** — every read/write goes through Next.js API
  routes. So no browser-side Supabase SDK is needed.

That means the DB is purely a server-side dependency of the Next.js host, and we can
substitute a local engine without touching the client design.

### DB options considered

| Option                         | Local / offline | Postgres parity | Install burden on host        | Verdict           |
| ------------------------------ | --------------- | --------------- | ----------------------------- | ----------------- |
| Supabase cloud (as written)    | ❌ needs uplink  | ✅               | none                          | Rejected (online) |
| Supabase self-hosted (Docker)  | ✅               | ✅               | Docker + multi-container      | Heavy for a laptop|
| **Local Postgres + Drizzle**   | ✅               | ✅ (exact)       | install/run Postgres          | Good, robust      |
| **Embedded (PGlite) + Drizzle**| ✅               | ✅ (Postgres WASM, in-process) | none — npm dep only | **Recommended**   |
| SQLite (better-sqlite3)        | ✅               | ⚠️ no `jsonb`, type drift | none                | Fallback          |

**Recommendation: PGlite (embedded Postgres) via Drizzle ORM.**
- Runs in-process inside the Next.js server — zero external services, nothing to install or
  start, fully offline. Aligns with "carry a laptop to the venue, it just works."
- Real Postgres semantics (incl. `jsonb` used by `ops_log.payload`), so the spec's schema
  ports verbatim and we keep the door open to "production could be self-hosted Postgres"
  later by switching only the Drizzle driver connection string.
- Drizzle gives typed schema + migrations and is driver-swappable (PGlite ↔ node-postgres),
  so promoting a session to a real Postgres box later is a config change, not a rewrite.

**If you prefer operational robustness over zero-install:** local Postgres + Drizzle is the
safe alternative (same schema, same ORM) — the only cost is requiring Postgres on the host.

> **Open question (Q1):** PGlite vs. local Postgres. Default in this plan is PGlite; flag if
> you'd rather require a real Postgres install on the event laptop.

### Module Repository sync stays online-optional

The Module Repository is the one piece that legitimately reaches outside the venue. Keep it
as an **explicit, optional, admin-triggered sync** (mirrors today's M6 `/modules/sync`):
when the host has internet, the admin pulls the latest module catalog into the local DB;
during the session everything reads from the local copy. No uplink → no sync, dispatch
unaffected.

---

## 2. Target stack & dependencies

```
Next.js (App Router) + TypeScript + Tailwind CSS
Drizzle ORM + PGlite            # local embedded Postgres  (Q1)
Server-Sent Events             # native, via ReadableStream in a route handler
mdns + qrcode                  # host discovery + join QR
ogg-opus-encoder + WS          # Zello PTT audio
jsonwebtoken (token-server)    # Zello JWT issuer (separate local process)
```

Installs (host app): `next react react-dom tailwindcss drizzle-orm @electric-sql/pglite mdns qrcode ogg-opus-encoder eventsource`
Installs (token-server): `express jsonwebtoken dotenv`

> **Deviation from spec §11.2:** spec lists `@supabase/*`; replaced by `drizzle-orm` +
> `@electric-sql/pglite`. Everything else in §11.2 is unchanged.

---

## 3. Data model (local, Postgres dialect)

Ported verbatim from spec §9 — no schema changes needed for local hosting:

`sessions` · `trains` · `train_statuses` · `authority_log` · `operators` · `ops_log` ·
`module_layouts` · `staging_tracks`

Notes:
- `ops_log.payload` → `jsonb` (PGlite supports it; this is why we avoid plain SQLite).
- `sessions.status` singleton invariant ("only one active session") enforced in
  `SessionManager`, plus a partial unique index on `status='active'`.
- `module_layouts.module_id` references the locally-synced Module Repository rows (carry the
  M6 `repo_modules` table forward as the local module catalog).

---

## 4. Cross-cutting concerns (decide once, applies to all phases)

1. **HTTPS for microphone (`getUserMedia`) — DECIDED (Q2).** PTT needs a secure context:
   real HTTPS with a valid cert on the LAN IP (only `localhost` is exempt). **Key insight:**
   the mic is *only* needed for Zello, and Zello *only* works when the venue has internet —
   which is exactly when public DNS + Let's Encrypt also work. So HTTPS is never required on
   the offline path.
   **Decision:** run **Caddy** in front of Next.js; Caddy auto-obtains/renews a real
   **Let's Encrypt cert via DNS-01** (e.g. Cloudflare free DNS API — no port-forwarding, no
   inbound internet). A fixed hostname (`dispatch.<yourdomain>`) has a public DNS A-record
   pointing at the host's **LAN IP** (private IPs are legal in public DNS). Operator phones
   get a **publicly-trusted cert with zero install and zero warnings** — this is what
   satisfies the spec's "any device, no install" rule. The QR code encodes the `https://`
   hostname URL, not the raw IP.
   - **Offline:** serve plain HTTP, disable PTT, core dispatch unaffected.
   - **Changing LAN IP per venue:** default to updating the A-record via the DNS provider API
     at session start (fallback: a DHCP reservation per venue).
   - **Dev:** `localhost` is already a secure context — no cert needed.
   - **Rejected:** mkcert internal CA and self-signed both require per-phone trust (CA install
     or warning tap-through), violating "no install"; self-signed kept only as last-resort
     fallback.
   - **New prerequisite on the owner:** a cheap domain + a DNS provider with an API
     (Cloudflare free tier).
2. **mDNS fallback.** Some mesh Wi-Fi blocks mDNS. QR code + manual URL entry are mandatory
   fallbacks, not nice-to-haves (spec §12).
3. **Server vs. client mode.** `SERVER_MODE=true` only on the host. The same Next.js build
   renders the Admin desktop UI (host) and the mobile operator shell (clients); role +
   server-mode gate which routes/panels appear.
4. **RBAC.** Session token issued on join; every API route re-checks role server-side
   (Engineer may PATCH only own trains; authority/E-stop are Dispatcher/Admin only).
5. **Offline by default.** Only Zello and the optional Module Repo sync ever require
   internet. Dispatch, trains, authority, SSE all run on the LAN with the local DB.

---

## 5. Phases

Each phase is independently testable before the next begins (spec §10). I've inserted a
**Phase 0** for the scaffolding + local-DB foundation that the cloud-assuming spec skips.

### Phase 0 — Project & local-DB foundation (NEW) ✅ DONE 2026-06-12
- [x] Move the current Electron/FastAPI app into `legacy/` (Q3); tagged `archive/electron-v0.7`.
      New app builds at repo **root**; work branch `v2-rebuild`.
- [x] Scaffold Next.js 16 (App Router, TS, Tailwind 4) at the repo root.
- [x] `lib/db/client.ts` — Drizzle + **PGlite** (Q1); on-disk data dir `./.data/freedispatcher`.
- [x] `lib/db/schema.ts` — all §9 tables + migration `0000_*`; `lib/db/seed.ts`.
- [x] `lib/config.ts` — typed env loader (`SERVER_MODE`, token/WiThrottle hosts, DB path).
- **Exit test ✅:** `npm run db:migrate` applies to a fresh local DB; `npm run db:seed` and
  `GET /api/session` round-trip through a route.

### Phase 1 — Server foundation (spec Days 1–3) ✅ DONE 2026-06-12
- [x] `app/api/session/route.ts` (GET state) + `app/api/session/join/route.ts` (join, HMAC token).
- [x] `app/api/events/route.ts` — SSE endpoint w/ keepalive; verified with `curl -N`.
- [x] `lib/server/SessionManager.ts` — active-session singleton, SSE fan-out, ops_log persist.
      Plus `lib/server/events.ts` (event contract) + `lib/server/sessionToken.ts` (RBAC token).
- [x] `lib/server/advertise.ts` — mDNS `_freedispatcher._tcp` (bonjour-service), IP detect, QR;
      `instrumentation.ts` starts advertising on host boot; `GET /api/server-info` for Admin header.
- **Exit test ✅:** an SSE subscriber received the `operator_joined` broadcast the instant a
  second client hit `/api/session/join`; event durably written to `ops_log`. (Live phone mDNS
  discovery to be confirmed on real hardware.) `npm run build` + ESLint clean.

### Phase 2 — Admin UI (spec Days 4–6)
- [ ] `app/admin/page.tsx` dashboard shell: session bar, train board, authority map, device
      list, ops log, quick actions (E-stop / reset / export).
- [ ] Train roster: `app/api/trains/*` + `app/admin/trains/page.tsx` (full CRUD).
- [ ] Module layout: `app/api/modules` + `app/admin/modules/page.tsx` (linear track-order
      editor) — reads the locally-synced module catalog.
- [ ] Authority: `app/api/authority/{grant,revoke}` + `ops_log` entries.
- [ ] `app/admin/settings/page.tsx` — WiThrottle + Zello config (persist only, no logic yet).
- **Exit test:** create a session, add trains, order modules, grant/revoke authority — all
      reflected in the local DB and broadcast over SSE.

### Phase 3 — Mobile client (spec Days 7–9)
- [ ] `app/(mobile)/join/page.tsx` — QR/URL → role picker → name → SSE connect.
- [ ] Mobile shell: `components/layout/MobileNav.tsx`, safe-area CSS, `<768px` breakpoint.
- [ ] `components/trains/TrainCard.tsx` + `app/(mobile)/trains/page.tsx` (filter + detail sheet).
- [ ] `app/(mobile)/dispatch/page.tsx` (Dispatcher metrics, cards, ops log, grant sheet).
- [ ] `app/(mobile)/modules|comms|settings/page.tsx`.
- **Exit test:** an Engineer joins from a phone, sees only their trains, updates status, and
      the Admin board updates live.

### Phase 4 — WiThrottle monitor (spec Day 10, optional feature)
- [ ] `lib/withrottle/WiThrottleMonitor.ts` — TCP client to port 12090; parse `MT+`/`MT-`.
- [ ] Wire into `SessionManager`: auto-assign train to engineer on loco acquire; fire
      `train_status_changed`.
- [ ] WiThrottle status indicator on Engineer settings + train card.
- **Exit test:** acquiring a DCC address in Engine Driver auto-links that train; if no
      JMRI/DCC-EX present, manual assignment still works (graceful degrade).

### Phase 5 — Zello PTT (spec Days 11–15)
- [ ] **HTTPS-on-LAN first** (see §4.1) — blocker for mic on phones.
- [ ] `token-server/` — local JWT issuer (`express` + `jsonwebtoken`); test with `curl`.
- [ ] `app/api/zello/token/route.ts` — proxy to token server.
- [ ] `lib/zello/ZelloService.ts` — WS singleton, logon, keepalive; `ZelloContext.tsx` + `useZello`.
- [ ] Opus encode/decode — validate standalone before integrating.
- [ ] `components/zello/PttOverlay.tsx` + `ChannelBar.tsx`; mount once in `app/layout.tsx`.
- [ ] SSE `zello_tx_start/stop` so Dispatchers see who's speaking.
- **Exit test:** hold-to-talk works on a real phone across every screen; channel switch
      (~2s) respects role defaults; speaker indicator shows on other devices.

---

## 6. Risks & open questions

| # | Item | Resolution |
| - | ---- | ---------- |
| Q1 | Local DB engine | ✅ **LOCKED: PGlite (embedded Postgres) + Drizzle** |
| Q2 | LAN HTTPS approach | ✅ **LOCKED: Caddy + Let's Encrypt DNS-01 on a fixed public hostname → host LAN IP; HTTP-only + PTT off when offline; self-signed as last-resort fallback** |
| Q3 | Repo layout | ✅ **LOCKED: old app → `legacy/` subdir + `archive/electron-v0.7` tag; new app at repo root** |
| Q4 | Zello account/keys + 4 channels ahead of Phase 5 (spec §11.3) | ⏳ needs your setup |
| Q5 | Domain + DNS provider w/ API for Q2 (Cloudflare free tier) | ⏳ needs your setup |
| —  | mDNS blocked on mesh Wi-Fi | QR + manual URL fallback (built in Phase 1) |
| —  | Opus bundle ~500KB | lazy-load the Zello module (spec §12) |

---

## 7. Suggested first executable step (once plan is approved)

Phase 0 + Phase 1 server foundation: scaffold Next.js, stand up Drizzle/PGlite with the §9
schema, and get the SSE + session-join loop working end-to-end on the LAN. That proves the
local-DB + realtime backbone before any UI is built on top of it.
