/**
 * GET /api/zello/token — returns the Zello auth token for the client logon.
 *
 * Free consumer tier (default): returns the **30-day development token** the
 * admin pasted into settings (`app_settings.zello.devToken`). No signing, no
 * Enterprise account. Kept server-side so it isn't baked into the bundle and
 * can be rotated without a redeploy.
 *
 * Optional production path: if no dev token is saved but a local token-server
 * is running (self-signed RS256, see token-server/), proxy to it.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // 1) Saved development token (free consumer tier).
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "zello"))
    .limit(1);
  const zello = (row?.value ?? {}) as { devToken?: string };
  if (zello.devToken && zello.devToken.trim()) {
    return NextResponse.json({ token: zello.devToken.trim(), source: "dev-token" });
  }

  // 2) Optional self-hosted token-server fallback.
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
    /* token server not running — fall through */
  }

  return NextResponse.json(
    { error: "no Zello token configured", configured: false },
    { status: 503 },
  );
}
