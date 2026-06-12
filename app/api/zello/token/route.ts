/**
 * GET /api/zello/token?username=... — proxy to the local token server (spec §7.7,
 * §5.2). Keeps the Zello private key server-side. Returns { token } or a clear
 * error if the token server isn't running / configured.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const username =
    new URL(req.url).searchParams.get("username") ?? "anonymous";
  try {
    const res = await fetch(`${config.tokenServerUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
      // token server is local; fail fast if it's not up
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: detail.error ?? `token server ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "token server unreachable", configured: false },
      { status: 503 },
    );
  }
}
