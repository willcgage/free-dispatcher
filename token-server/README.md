# Zello token server (OPTIONAL — self-hosted production path)

> **You usually don't need this.** On the **free consumer tier**, paste the
> 30-day **Sample Development Token** from developers.zello.com into the Admin
> → Settings → Zello field. `/api/zello/token` serves that directly — no signing,
> no Enterprise account, no token server.
>
> Use this token server only if you have access to a Zello **Issuer + Private
> Key** (self-signed/production) and want auto-rotated tokens instead of pasting
> a dev token every 30 days. `/api/zello/token` falls back to it when no dev
> token is saved.

Local RS256 JWT issuer for the Zello Channel API (spec §7.7). Runs on the event
host alongside the Next.js app so the private key never reaches the browser.

## One-time setup

1. Create a free Zello account at [zello.com](https://zello.com).
2. Register at [developers.zello.com](https://developers.zello.com) — save your
   **Issuer** and **Private Key**.
3. In the Zello mobile app, create channels `FD-OpsAll`, `FD-MainLine`,
   `FD-Yard`, `FD-Dispatch`, each set to "Anyone can talk".

## Run

```bash
cd token-server
cp .env.example .env     # then fill in ZELLO_ISSUER + ZELLO_PRIVATE_KEY
npm install
npm start                # listens on :3001
```

Point the main app at it via `NEXT_PUBLIC_TOKEN_SERVER_URL` (default
`http://localhost:3001`).

`GET /health` reports whether credentials are configured. `POST /token`
`{ "username": "..." }` returns `{ "token": "<jwt>" }`.
