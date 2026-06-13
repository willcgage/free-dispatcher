# Multi-device testing

How to run Free Dispatcher on a host laptop and join it from real phones/tablets
on the same Wi-Fi.

> Core dispatch (sessions, trains, authority, modules, the operator roster, and
> SSE realtime) all work over plain HTTP on the LAN — no HTTPS or certificates
> needed. (Voice/push-to-talk is not part of the app right now — see Phase 5 in
> [`V2_BUILD_PLAN.md`](V2_BUILD_PLAN.md).)

---

## 1. Prerequisites

- **One host machine** (laptop) with Node.js 20+.
- **Test devices** (phones/tablets/another laptop) on the **same Wi-Fi/LAN** as
  the host.
- A network that lets devices talk to each other. Guest/"client isolation"
  Wi-Fi blocks this — use a normal home/club network or a dedicated router.
- mDNS auto-discovery is a bonus, not required; the **QR code / typed URL**
  always works (some mesh Wi-Fi blocks mDNS).

---

## 2. Start the host

```bash
npm install
cp .env.example .env.local        # set SERVER_MODE=true (already the default)
npm run db:migrate
npm run db:seed                   # demo session + trains to test against
npm run dev
```

- Make sure **`SERVER_MODE=true`** is in `.env.local` (enables Admin + mDNS).
- Next prints a **Network:** URL like `http://192.168.1.23:3000` — that's the
  host's LAN address. The Admin header also shows it as a **QR code**
  (served by `GET /api/server-info`).
- **Firewall:** the first time the server binds, Windows/macOS may prompt to
  allow Node on the network — **allow it on private networks**, or devices
  can't reach the host.

Find the host IP manually if needed: `ipconfig` (Windows) / `ipconfig getifaddr en0` (macOS).

---

## 3. Join from a device

On each phone, open the host URL (e.g. `http://192.168.1.23:3000`):

1. Scan the **QR** in the Admin header, or type the URL.
2. Tap **Join as operator** → pick a role (Dispatcher / Engineer / Yardmaster)
   → enter a name → **Join**.
3. You land on that role's home screen. The Admin dashboard's **Connected
   devices** panel updates live.

---

## 4. What to test across devices

- [ ] A second device joining appears in Admin → **Connected devices** instantly
      (SSE realtime).
- [ ] **RBAC**: each role sees only its screens (e.g. Dispatch is Dispatcher/Admin
      only); engineers can act only on their own trains.
- [ ] A train status / authority change made on one device shows on the others
      and on the Admin dashboard live.
- [ ] **Emergency Stop** from Admin revokes authority everywhere.
- [ ] Rejoin after a refresh keeps the operator's identity for the session.

---

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Device can't reach the host URL | Same Wi-Fi? Client-isolation off? Allow Node through the host firewall (private network). Try the IP from `ipconfig`/`ifconfig`, not `localhost`. |
| QR / auto-discovery doesn't appear | mDNS may be blocked — type the host URL manually. Confirm `SERVER_MODE=true` on the host. |
| `/admin` says no token / forbidden | Admin is host-only — `SERVER_MODE=true` must be set on the machine serving it. |
| No trains/session to test with | Run `npm run db:seed`, or create a session in Admin → Session. |
