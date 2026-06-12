# Zello token server

Local JWT issuer for the Zello Channel API (spec §7.7). Runs on the event host
alongside the Next.js app; the main app's `/api/zello/token` route proxies here
so the Zello private key never reaches the browser.

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
