# Multi-device testing

How to run Free Dispatcher on a host laptop and join it from real phones on the
same Wi-Fi — including the HTTPS setup needed to test **voice (push-to-talk)**
across devices.

> **TL;DR**
> - Everything *except the microphone* works over plain HTTP on the LAN today.
> - The mic (`getUserMedia`) needs a **secure context**. That's free on
>   `localhost`, but any other device needs **HTTPS**. Use
>   `npm run dev:https` for a quick test (tap through the cert warning), or
>   [mkcert](#option-b--mkcert-trusted-lan-cert-no-warnings) for a clean LAN
>   cert with no warnings.

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
npm run dev                       # HTTP — fine for everything but the mic
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

This confirms LAN reachability, SSE realtime, and RBAC — **no HTTPS needed** for
trains, dispatch, authority, modules, or the operator roster.

---

## 4. Testing voice (push-to-talk) — requires HTTPS

The mic is blocked on a plain-HTTP LAN origin (browsers only treat `localhost`
and HTTPS as secure). The Comms screen shows a warning and refuses to enable
voice until the page is served securely. Pick one of the options below.

### Option A — `npm run dev:https` (quickest)

```bash
npm run dev:https      # next dev with a self-signed cert
```

Then open **`https://<host-lan-ip>:3000`** on each device.

- Each device shows a **certificate warning** (the cert is self-signed). Tap
  **Advanced → proceed/visit** to continue. iOS Safari is the strictest here;
  Chrome (desktop/Android) is the most forgiving.
- Good for a fast smoke test. If a device flat-out refuses to proceed (no
  "proceed anyway"), use Option B instead.

### Option B — mkcert (trusted LAN cert, no warnings)

[mkcert](https://github.com/FiloSottile/mkcert) makes a locally-trusted cert so
devices connect with **no warnings** — the most reliable multi-device path.

```bash
# Install mkcert (e.g. `choco install mkcert` / `scoop install mkcert` / `brew install mkcert`)
mkcert -install                                   # create + trust a local CA
mkcert 192.168.1.23 free-dispatcher.local localhost   # use YOUR host LAN IP

# Run Next with those cert files:
npm run dev:https -- --experimental-https-key ./192.168.1.23-key.pem \
                     --experimental-https-cert ./192.168.1.23.pem
```

- Install the mkcert **root CA on each test device** so it trusts the cert:
  - **iOS:** AirDrop/email the `rootCA.pem` (path from `mkcert -CAROOT`), open
    it → install the profile → **Settings → General → About → Certificate Trust
    Settings → enable full trust**.
  - **Android:** Settings → Security → Encryption & credentials → Install a
    certificate → CA certificate.
- Then open `https://192.168.1.23:3000` — no warning, mic works.
- `*.pem` is gitignored, so certs won't be committed.

### Option C — real cert via a domain (production path, issue #23)

For a venue deployment with **zero per-device setup**, the plan is Caddy in
front of Next.js auto-obtaining a **Let's Encrypt cert via DNS-01** (Cloudflare
free DNS), with a public DNS record pointing at the host's LAN IP. This needs a
domain + a DNS provider API token and is tracked in **issue #23** — not required
for a test, but it's the no-warnings, no-install answer for real events.

---

## 5. Voice test checklist

With two+ devices joined to the **same channel** (e.g. both Dispatchers on
*Dispatch*) over HTTPS:

- [ ] **Enable voice** on each device (grant the mic permission prompt).
- [ ] **Hold to talk** on device A → device B hears audio; A shows "TALKING",
      B's roster highlights A as 🔊, and the **Admin** dashboard shows A speaking.
- [ ] Release → indicators clear everywhere.
- [ ] **Channel switch** respects role access (e.g. an Engineer has no *Yard*
      channel).
- [ ] **Stuck-indicator regression** (fixed in #28): while device A is holding
      PTT, **kill its tab/connection without releasing** → device B and Admin
      should clear A's 🔊 within a few seconds (the signaling drop broadcasts a
      `talking:false`).

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Device can't reach the host URL | Same Wi-Fi? Client-isolation off? Allow Node through the host firewall (private network). Try the IP from `ipconfig`/`ifconfig`, not `localhost`. |
| "Microphone needs a secure context" on Comms | You're on HTTP. Use `https://…` via Option A/B above. |
| Cert warning won't let you proceed (esp. iOS) | Use Option B (mkcert) and trust the root CA on the device. |
| QR / auto-discovery doesn't appear | mDNS may be blocked — type the host URL manually. Confirm `SERVER_MODE=true` on the host. |
| `/admin` says no token / forbidden | Admin is host-only — `SERVER_MODE=true` must be set on the machine serving it. |
| No trains/session to test with | Run `npm run db:seed`, or create a session in Admin → Session. |
| Audio one-way only | Both peers must **Enable voice** and grant the mic; check each browser's site mic permission. |
