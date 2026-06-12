/**
 * Free Dispatcher — Zello token server (spec §7.7).
 *
 * A lightweight local Node process that issues short-lived JWTs for the Zello
 * Channel API. Runs on the event host alongside the Next.js app. The Next.js
 * route /api/zello/token proxies to this so the private key never reaches the
 * browser.
 *
 * Setup: copy .env.example to .env and fill in your Zello developer creds
 * (developers.zello.com → Issuer + Private Key). Then: npm install && npm start
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ISSUER = process.env.ZELLO_ISSUER;
// Private key may contain literal "\n" sequences when stored on one line.
const PRIVATE_KEY = (process.env.ZELLO_PRIVATE_KEY || "").replace(/\\n/g, "\n");

function configured() {
  return Boolean(ISSUER && PRIVATE_KEY);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, configured: configured() });
});

app.post("/token", (req, res) => {
  if (!configured()) {
    return res
      .status(503)
      .json({ error: "token server not configured (missing ZELLO_ISSUER / ZELLO_PRIVATE_KEY)" });
  }
  const username = (req.body && req.body.username) || "anonymous";
  try {
    const token = jwt.sign({ iss: ISSUER, sub: username }, PRIVATE_KEY, {
      algorithm: "RS256",
      expiresIn: "60m",
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "failed to sign token", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(
    `[token-server] listening on :${PORT} — Zello creds ${configured() ? "configured" : "NOT configured"}`,
  );
});
