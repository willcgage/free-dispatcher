/**
 * GET /api/zello/token — returns the Zello auth token for the client logon.
 *
 * Resolution order:
 *   1. **Self-signed (recommended):** if ZELLO_ISSUER + ZELLO_PRIVATE_KEY are
 *      in the server env (.env.local, gitignored), sign a short-lived RS256
 *      JWT here. No 30-day expiry, no separate process, key never leaves the
 *      server. (Free developer keys from developers.zello.com.)
 *   2. Saved 30-day development token from Admin → Settings.
 *   3. Optional self-hosted token-server.
 */
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // 1) Self-sign with developer keys from env.
  const issuer = process.env.ZELLO_ISSUER;
  // Private key may be stored with literal "\n" on one line.
  const privateKey = process.env.ZELLO_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (issuer && privateKey) {
    try {
      const token = jwt.sign({ iss: issuer, azp: "freedispatcher" }, privateKey, {
        algorithm: "RS256",
        expiresIn: "12h",
      });
      return NextResponse.json({ token, source: "self-signed" });
    } catch {
      /* fall through to other sources */
    }
  }

  // 2) Saved development token (free consumer tier).
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "zello"))
    .limit(1);
  const zello = (row?.value ?? {}) as { devToken?: string };
  if (zello.devToken?.trim()) {
    return NextResponse.json({ token: zello.devToken.trim(), source: "dev-token" });
  }

  // 3) Optional self-hosted token-server.
  try {
    const res = await fetch(`${config.tokenServerUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "freedispatcher" }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const j = await res.json();
      return NextResponse.json({ token: j.token, source: "token-server" });
    }
  } catch {
    /* not running — fall through */
  }

  return NextResponse.json(
    { error: "no Zello token configured", configured: false },
    { status: 503 },
  );
}
